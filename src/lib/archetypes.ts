/** Naming a deck after the Limitless archetype it matches (play.limitlesstcg.com/decks). */
import data from './limitless-archetypes.json'
import { cardSlug } from './parser'

export interface Archetype { id: string; name: string; key: string; count: number }
export const LIMITLESS: Archetype[] = data

const byKey = new Map(LIMITLESS.map((a) => [a.key, a]))
export const archetypeName = (key: string | null | undefined) => (key ? byKey.get(key)?.name : undefined)

/**
 * The Limitless archetype a deck key belongs to: an exact match, or else the archetype whose Pokémon
 * are all in the key ('hydreigon,pidgeot' is Hydreigon), naming the most Pokémon, then the most played.
 */
export function limitlessArchetype(key: string | null | undefined): Archetype | undefined {
  if (!key) return undefined
  const exact = byKey.get(key)
  if (exact) return exact
  // Mega and regular forms count as the same Pokémon here: Training Court's 'froslass-mega' is Limitless's Starmie Froslass
  const base = (p: string) => p.replace(/-mega$/, '')
  const have = new Set(key.split(','))
  const haveBase = new Set([...have].map(base))
  const exactHits = (a: Archetype) => a.key.split(',').filter((p) => have.has(p)).length
  return LIMITLESS
    .filter((a) => a.key.split(',').every((p) => haveBase.has(base(p))))
    .sort((x, y) => y.key.split(',').length - x.key.split(',').length || exactHits(y) - exactHits(x) || y.count - x.count)[0]
}

/** The Pokémon to draw for a deck: its Limitless archetype's icons, else the first two in its key. */
export const deckSprites = (key: string | null | undefined): string[] =>
  key ? (limitlessArchetype(key)?.key ?? key).split(',').slice(0, 2) : []

export const spriteUrl = (slug: string) => `https://r2.limitlesstcg.net/pokemon/gen9/${slug}.png`

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
