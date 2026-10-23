import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cardSlug, detectArchetype, gameStats, LogError } from '@/lib/parser'

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
