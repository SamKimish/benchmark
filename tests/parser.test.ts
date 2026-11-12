import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cardSlug, detectArchetype, gameStats, LogError } from '@/lib/parser'
import { parse } from '@/lib/parser/parse'
import { retreatLocks } from '@/lib/parser/stats'
import { abilityLocks } from '@/lib/parser/ability-lock'
import { normalize } from '@/lib/parser/text'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

// Expected values come from the original Python pipeline's output for the same logs.
describe('gameStats', () => {
  it('reads a Dragapult win on prizes', () => {
    const s = gameStats(fixture('pult-win.txt'), { archetype: 'dragapult,dusknoir' })
    expect(s).toMatchObject({
      me: 'Kimish17', opponent: 'Rival99', result: 'W', went_first: false, prizes_taken: 6, prizes_given: 4,
      dive_placements: 4, dive_converted: 3, hammers_played: 3, hammer_heads: 1, first_attacker_turn: 5,
      end_reason: 'Prizes', opening_active: 'Meowth ex', mulligans: 0, closer: 'Dragapult ex',
      prize_takers: { 'Dragapult ex': 6 }, tags: ['Slow start', "Line KO'd early", 'Hand disrupted'],
    })
    expect(s.opp_archetype).toBe('excadrill-mega')
  })

  it('names a deck that played Crushing Hammer as its Hammer version, and tags what went right', () => {
    const s = gameStats(fixture('pult-win.txt'))
    expect(s.my_archetype).toBe('dragapult,crushing-hammer')
    expect(s.first_attacker_turn).toBe(5)   // the Dragapult plan still applies to Hammer Pult
    expect(s.win_tags).toEqual(['Item locked them', 'Disrupted their hand'])
    expect(gameStats(fixture('lopunny.txt')).win_tags).toEqual(['Fast setup'])
    expect(gameStats(fixture('pult-loss.txt')).win_tags).toEqual([])
  })

  it('tags an early concede', () => {
    const s = gameStats(fixture('pult-loss.txt'))
    expect(s.my_archetype).toBe('dragapult')
    expect(s).toMatchObject({ result: 'L', went_first: false, end_reason: 'I conceded', first_attacker_turn: null })
    expect(s.tags).toEqual(["Line KO'd early", 'Hand disrupted', 'Early concede'])
  })

  it('handles a CRLF export of another deck', () => {
    const s = gameStats(fixture('lopunny.txt'))
    expect(s).toMatchObject({ me: 'Kimish17', opponent: 'Rival42', result: 'W', went_first: false, won_flip: true, end_reason: 'Opponent timed out' })
    expect(s.opening_hand).toContain('Mew ex')
  })

  it('leaves the result open when the log is cut off', () => {
    const log = fixture('pult-win.txt').trimEnd().split(/\r?\n/).slice(0, -1).join('\n')
    expect(gameStats(log).result).toBeNull()
  })

  it('reads the newer "Turn # N - Name\'s Turn" headers with CRLF line endings', () => {
    const old = fixture('pult-win.txt')
    let n = 0
    const numbered = old.split(/\r?\n/).map((l) => (/^\S+'s Turn$/.test(l) ? `Turn # ${++n} - ${l}` : l)).join('\r\n')
    expect(n).toBeGreaterThan(0)
    expect(gameStats(numbered)).toEqual(gameStats(old))
  })

  it('tags a retreat lock that left my Active stuck', () => {
    const log = fixture('retreat-lock.txt')
    const s = gameStats(log)
    expect(s.result).toBe('L')
    expect(s.tags).toContain('Retreat locked')
    // seven Impounds; the first, on a Gardevoir ex that attacked and survived, didn't hurt
    expect(retreatLocks(parse(log), 'opp')).toBe(6)
    // switching the locked Pokémon out on my next turn gets out of the lock
    const escaped = log.replace(/(Kimish17's Turn\r?\n)/g, "$1Kimish17's Gardevoir ex is now in the Active Spot.\n")
    expect(gameStats(escaped).tags).not.toContain('Retreat locked')
    expect(retreatLocks(parse(log), 'me')).toBe(0)
  })

  it('tags an ability lock that switched off Abilities I had in play', () => {
    const log = fixture('ability-lock.txt')
    const s = gameStats(log)
    expect(s.tags).toContain('Ability locked')
    // Legendary Pyroduct was up with Drakloak in play on my turns 2, 3 and 4 (until Jamming Tower replaced it) and 6
    expect(s.ability_locked_turns).toBe(4)
    expect(s.ability_locked_by).toEqual(['Legendary Pyroduct'])
    expect(s.win_tags).not.toContain('Ability locked them')
    // a Pyroduct with nothing of mine that has an Ability in play doesn't count
    const noAbilities = log.replace(/Drakloak/g, 'Dragapult ex').replace(/Dudunsparce/g, 'Dunsparce')
    expect(abilityLocks(normalize(noAbilities), 'Kimish17', 'Rival8', 'opp').turns).toBe(0)
    // nor does my own Pyroduct
    const mine = log.replace(/Rival8 played Legendary Pyroduct/g, 'Kimish17 played Legendary Pyroduct')
    expect(gameStats(mine).tags).not.toContain('Ability locked')
  })

  it('rejects text that is not a game log', () => {
    expect(() => gameStats('hello')).toThrow(LogError)
  })
})

describe('archetypes', () => {
  it('makes Limitless-style slugs', () => {
    expect(cardSlug('Mega Starmie ex')).toBe('starmie-mega')
    expect(cardSlug("Team Rocket's Spidops")).toBe('spidops')
    expect(cardSlug("Lillie's Clefairy ex")).toBe('clefairy')
    expect(cardSlug('Wellspring Mask Ogerpon ex')).toBe('ogerpon-wellspring')
    expect(cardSlug('Teal Mask Ogerpon ex')).toBe('ogerpon')
    expect(cardSlug('Paldean Tauros')).toBe('tauros-paldea')
  })

  it('names a deck from Pokémon that never evolved', () => {
    expect(detectArchetype(['Dreepy', 'Drakloak', 'Fezandipiti ex'])).toBe('dragapult')
    expect(detectArchetype(['Dreepy', 'Dragapult ex', 'Duskull', 'Dusclops', 'Dusknoir'])).toBe('dragapult,dusknoir')
  })
})

describe('timeline', () => {
  it('splits a log into turns with attacks, Knockouts and the running score', async () => {
    const { timeline, knockouts } = await import('@/lib/parser/timeline')
    const tl = timeline(fixture('pult-win.txt'))
    expect(tl.turns[0]).toMatchObject({ who: 'opp', n: 1 })
    const attack = tl.turns[1].events.find((e) => e.kind === 'attack')
    expect(attack).toMatchObject({ who: 'me', mon: 'Budew', card: 'Itchy Pollen', target: 'Shaymin', damage: 10 })
    expect(attack?.text).toBe('Your Budew used Itchy Pollen on Rival99’s Shaymin for 10 damage.')
    expect(knockouts(tl)[0]).toMatchObject({ who: 'me', mon: 'Drakloak', prizes: 1, score: [0, 1] })
    expect(tl.turns.at(-1)?.score).toEqual([6, 4])
    expect(tl.end).toBe('You won. All Prize cards taken.')
  })
})
