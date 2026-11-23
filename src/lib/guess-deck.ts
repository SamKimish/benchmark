import { baseArchetype, isHammer } from './parser'
import type { Deck } from './types'

/** The deck's main Pokémon: 'dragapult,dudunsparce,crushing-hammer' is 'dragapult'. */
const mainMon = (key: string | null) => baseArchetype(key)?.split(',')[0] || null

/**
 * The deck a pasted game was most likely played with.
 *
 * Candidates are my decks built on the same main Pokémon as the game (Hammer Pult, Straight Pult
 * and a Dragapult Dudunsparce build are all Dragapult). If the log showed a Crushing Hammer, only
 * hammer decks count. Among the candidates, the deck line I've played most recently wins (a game
 * pasted mid-session is almost always the deck I've been on all day), and within that line its
 * newest active version. With no candidate at all, it's the newest version of whatever I played last.
 *
 * `lastPlayed` maps deck id to the ISO time of its newest game.
 */
export function guessDeck(decks: Deck[], arch: string | null, lastPlayed: Record<string, string>): string {
  const lineLast = new Map<string, string>()
  for (const d of decks) {
    const at = lastPlayed[d.id] ?? ''
    if (at > (lineLast.get(d.line_id) ?? '')) lineLast.set(d.line_id, at)
  }
  const recent = (a: Deck, b: Deck) =>
    (lineLast.get(b.line_id) ?? '').localeCompare(lineLast.get(a.line_id) ?? '')
    || Number(b.active) - Number(a.active) || b.version_order - a.version_order
  const newestOf = (line: string) =>
    decks.filter((d) => d.line_id === line).sort((a, b) => Number(b.active) - Number(a.active) || b.version_order - a.version_order)[0].id

  const mon = mainMon(arch)
  const near = mon ? decks.filter((d) => mainMon(d.archetype) === mon) : []
  const hammers = near.filter((d) => isHammer(d.archetype))
  const pool = isHammer(arch) && hammers.length ? hammers : near
  if (pool.length) return newestOf([...pool].sort(recent)[0].line_id)
  const last = decks.filter((d) => lastPlayed[d.id]).sort(recent)[0]
  return last ? newestOf(last.line_id) : ''
}
