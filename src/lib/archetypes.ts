/** Naming a deck after the Limitless archetype it matches (play.limitlesstcg.com/decks). */
import data from './limitless-archetypes.json'
import { cardSlug } from './parser'

export interface Archetype { id: string; name: string; key: string; count: number }
export const LIMITLESS: Archetype[] = data

const byKey = new Map(LIMITLESS.map((a) => [a.key, a]))
export const archetypeName = (key: string | null | undefined) => (key ? byKey.get(key)?.name : undefined)

/**
 * The Limitless archetypes a decklist's Pokémon could be, best first. An archetype matches when every
 * Pokémon it is named after is in the list; the one naming the most Pokémon wins, then the most played.
 */
export function matchArchetypes(pokemonNames: string[], limit = 6): Archetype[] {
  const seen = new Set(pokemonNames.map(cardSlug))
  return LIMITLESS
    .filter((a) => a.key.split(',').every((p) => seen.has(p)))
    .sort((x, y) => y.key.split(',').length - x.key.split(',').length || y.count - x.count)
    .slice(0, limit)
}
