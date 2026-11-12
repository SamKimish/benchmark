/**
 * "Ability locked": turns where the other player had something in play that switched off Abilities the
 * locked player's Pokémon have. TCG Live doesn't log Abilities that can't be used, so this follows both
 * boards through the log and counts the locked player's turns where a lock was up while they had in play
 * a Pokémon whose Ability it switched off.
 */
import ABILITY_MON_FLAGS from './ability-mons.json'
import { esc } from './text'

/** Pokémon with an Ability -> flags from the card data (e Evolution, 2 Stage 2, c Colorless, r Rule Box, f Future). */
const ABILITY_MONS: Record<string, string> = ABILITY_MON_FLAGS

interface Board { active: string | null; bench: string[] }
interface Lock {
  /** where the lock card has to be for it to work: a Stadium the opponent played, or their Active or Bench */
  from: 'stadium' | 'active' | 'bench'
  /** which of the locked player's Pokémon lose their Abilities */
  hits: (mon: string, flags: string, where: 'active' | 'bench') => boolean
}

/** The ability locks in Standard. build-cards.mjs lists the cards in the data that switch Abilities off, to add new ones here. */
export const ABILITY_LOCKS: Record<string, Lock> = {
  // Evolution Pokémon in play (both yours and your opponent's) have no Abilities.
  'Legendary Pyroduct': { from: 'stadium', hits: (_, f) => f.includes('e') },
  // Colorless Pokémon in play (both yours and your opponent's) have no Abilities.
  "Team Rocket's Watchtower": { from: 'stadium', hits: (_, f) => f.includes('c') },
  // Initialization, while Active: Pokémon with a Rule Box in play have no Abilities, except for Future Pokémon.
  'Iron Thorns ex': { from: 'active', hits: (_, f) => f.includes('r') && !f.includes('f') },
  // Midnight Fluttering, while Active: your opponent's Active Pokémon has no Abilities.
  'Flutter Mane': { from: 'active', hits: (_, __, where) => where === 'active' },
  // Sticky Bind, while on the Bench: Benched Stage 2 Pokémon have no Abilities.
  Gastrodon: { from: 'bench', hits: (_, f, where) => f.includes('2') && where === 'bench' },
}

export interface AbilityLock { turns: number; by: string[] }

/** The `by` player's locks on the other player's Abilities: how many of the locked player's turns, and with what. */
export function abilityLocks(text: string, me: string, opp: string | null, by: 'me' | 'opp'): AbilityLock {
  const none = { turns: 0, by: [] }
  if (!opp) return none
  const lockBy = by === 'me' ? me : opp
  const victim = by === 'me' ? opp : me
  const boards: Record<string, Board> = { [me]: { active: null, bench: [] }, [opp]: { active: null, bench: [] } }
  const names = `(${esc(me)}|${esc(opp)})`
  const rePlayed = new RegExp(`^-? ?${names} (?:played|drew) (.+?) (?:to|and played it to) the (Bench|Active Spot)\\.`)
  const reMany = new RegExp(`^- ${names} drew \\d+ cards and played them to the Bench`)
  const reEvolved = new RegExp(`^-? ?${names} evolved (.+?) to (.+?) (?:in the Active Spot|on the Bench)`)
  const reNowActive = new RegExp(`^-? ?${names}['’]s (.+?) is now in the Active Spot\\.`)
  const reKo = new RegExp(`^${names}['’]s (.+?) was Knocked Out!`)
  const reStadium = new RegExp(`^${names} played (.+?) to the Stadium spot\\.`)
  const rePlayedMon = new RegExp(`^${names} played (.+?)\\.$`)
  const reShuffled = new RegExp(`^- ${names} shuffled \\d+ cards? into their deck`)

  let stadium: { card: string; by: string } | null = null
  let turnOf: string | null = null
  let lockedThisTurn = new Set<string>()
  let turns = 0
  const used = new Set<string>()
  // A Pokémon "played" from play (Dudunsparce's Run Away Draw) that then shuffles itself into the deck
  let leaving: { who: string; mon: string; shuffled: boolean } | null = null
  let manyBench: string | null = null

  const remove = (b: Board, mon: string) => {
    if (b.active === mon) b.active = null
    else { const i = b.bench.indexOf(mon); if (i >= 0) b.bench.splice(i, 1) }
  }
  /** The locks up right now, and whether one of them hits a Pokémon the locked player has in play. */
  const check = () => {
    if (turnOf !== victim) return
    const theirs = boards[lockBy], mine = boards[victim]
    const up: string[] = []
    if (stadium && stadium.by === lockBy && ABILITY_LOCKS[stadium.card]?.from === 'stadium') up.push(stadium.card)
    if (theirs.active && ABILITY_LOCKS[theirs.active]?.from === 'active') up.push(theirs.active)
    for (const b of new Set(theirs.bench)) if (ABILITY_LOCKS[b]?.from === 'bench') up.push(b)
    for (const card of up) {
      const lock = ABILITY_LOCKS[card]
      const hit = [[mine.active, 'active'] as const, ...mine.bench.map((m) => [m, 'bench'] as const)]
        .some(([m, where]) => m && m in ABILITY_MONS && lock.hits(m, ABILITY_MONS[m], where))
      if (hit) lockedThisTurn.add(card)
    }
  }
  const endTurn = () => {
    if (turnOf === victim && lockedThisTurn.size) { turns++; lockedThisTurn.forEach((c) => used.add(c)) }
    lockedThisTurn = new Set()
  }

  for (const raw of text.split('\n')) {
    const ln = raw.trim()
    if (!ln) continue
    const h = ln.match(/^(\S+)'s Turn$/)
    if (h) { endTurn(); turnOf = h[1]; leaving = null; check(); continue }
    let m
    if (ln.startsWith('•')) {
      const cards = ln.slice(1).split(',').map((c) => c.trim())
      if (manyBench) { boards[manyBench].bench.push(...cards); manyBench = null }
      else if (leaving?.shuffled) {
        if (cards.includes(leaving.mon)) remove(boards[leaving.who], leaving.mon)
        leaving = null
      }
      continue
    }
    manyBench = null
    if ((m = ln.match(reMany))) { manyBench = m[1]; continue }
    if ((m = ln.match(reShuffled))) { if (leaving?.who === m[1]) leaving.shuffled = true; else leaving = null; continue }
    if (!ln.startsWith('-')) leaving = null
    if ((m = ln.match(reStadium))) stadium = { card: m[2], by: m[1] }
    else if (stadium && (ln.endsWith(` discarded ${stadium.card}.`) || ln.replace(/^- /, '').startsWith(`${stadium.card} was discarded`))) stadium = null
    else if ((m = ln.match(rePlayed))) {
      const b = boards[m[1]]
      if (m[3] === 'Bench') b.bench.push(m[2]); else b.active = m[2]
    } else if ((m = ln.match(reEvolved))) {
      const b = boards[m[1]]
      if (ln.includes('in the Active Spot')) b.active = m[3]
      else { const i = b.bench.indexOf(m[2]); if (i >= 0) b.bench[i] = m[3]; else b.bench.push(m[3]) }
    } else if ((m = ln.match(reNowActive))) {
      const b = boards[m[1]]
      const i = b.bench.indexOf(m[2])
      if (i >= 0) b.bench.splice(i, 1)
      if (b.active && b.active !== m[2]) b.bench.push(b.active)
      b.active = m[2]
    } else if ((m = ln.match(reKo))) remove(boards[m[1]], m[2])
    else if ((m = ln.match(rePlayedMon))) {
      const b = boards[m[1]]
      if (b.active === m[2] || b.bench.includes(m[2])) leaving = { who: m[1], mon: m[2], shuffled: false }
    }
    check()
  }
  endTurn()
  return { turns, by: [...used].sort() }
}
