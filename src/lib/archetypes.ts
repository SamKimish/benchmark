/** Naming a deck after the Limitless archetype it matches (play.limitlesstcg.com/decks). */
import data from './limitless-archetypes.json'
import { baseArchetype, cardSlug, HAMMER, isHammer, withHammer } from './parser'

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
  if (isHammer(key)) return limitlessArchetype(baseArchetype(key))   // Hammer Pult is still Dragapult to Limitless
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

/** The Pokémon to draw for a deck: its Limitless archetype's icons, else the first two in its key. A Hammer
 * deck is its main Pokémon and a hammer. */
export function deckSprites(key: string | null | undefined): string[] {
  if (!key) return []
  if (isHammer(key)) return [...deckSprites(baseArchetype(key)).slice(0, 1), HAMMER]
  return (limitlessArchetype(key)?.key ?? key).split(',').slice(0, 2)
}

/** Megas Limitless has no sprite for yet; they are drawn as the regular Pokémon. */
const NO_MEGA_SPRITE = new Set(['golurk-mega', 'golisopod-mega', 'zeraora-mega'])

/**
 * The Limitless sprite name for one of our slugs, where the two differ: our slugs come from card names
 * ('Fan Rotom' -> 'fan-rotom'), Limitless names forms after the species ('rotom-fan').
 */
export function spriteSlug(slug: string): string {
  if (NO_MEGA_SPRITE.has(slug)) return slug.replace(/-mega$/, '')
  return slug
    .replace(/^(.+)-([xy])-mega$/, '$1-mega-$2')                      // charizard-x-mega -> charizard-mega-x
    .replace(/^(fan|frost|heat|mow|wash)-rotom$/, 'rotom-$1')
    .replace(/^(black|white)-kyurem$/, 'kyurem-$1')
    .replace(/^bloodmoon-ursaluna$/, 'ursaluna-bloodmoon')
    .replace(/^castform-(\w+)-form$/, 'castform-$1')
    .replace(/^(clodsire|obstagoon|perrserker|sirfetchd|runerigus|cursola|mr-rime|sneasler|overqwil|kleavor)-(paldea|galar|hisui)$/, '$1')   // only one form exists
}

export const spriteUrl = (slug: string) =>
  slug === HAMMER ? '/sprites/crushing-hammer.png' : `https://r2.limitlesstcg.net/pokemon/gen9/${spriteSlug(slug)}.png`

/** A sprite to try when Limitless has none for a slug: the regular form of a Mega or regional Pokémon. */
export const fallbackSpriteUrl = (slug: string): string | null => {
  const base = spriteSlug(slug).replace(/-mega(-[xy])?$/, '').replace(/-(alola|galar|hisui|paldea)$/, '')
  return base !== spriteSlug(slug) ? `https://r2.limitlesstcg.net/pokemon/gen9/${base}.png` : null
}

/**
 * The Limitless archetypes a decklist's Pokémon could be, best first. An archetype matches when every
 * Pokémon it is named after is in the list; the one naming the most Pokémon wins, then the most played.
 * A list with Crushing Hammer in it gets the Hammer versions first ('Hammer Pult' before 'Dragapult').
 */
export function matchArchetypes(pokemonNames: string[], limit = 6, hammer = false): Archetype[] {
  const seen = new Set(pokemonNames.map(cardSlug))
  const hits = LIMITLESS
    .filter((a) => a.key.split(',').every((p) => seen.has(p)))
    .sort((x, y) => y.key.split(',').length - x.key.split(',').length || y.count - x.count)
    .slice(0, limit)
  if (!hammer) return hits
  const hammered = hits.map((a) => ({ ...a, id: `${a.id}-hammer`, key: withHammer(a.key), name: a.key === 'dragapult' ? 'Hammer Pult' : `${a.name} Hammers` }))
  return [...hammered, ...hits].slice(0, limit)
}

/** The sprites a deck is drawn with: the ones chosen for it, else its archetype's. */
export const spritesOf = (deck: { sprites?: string[] | null; archetype: string | null } | null | undefined): string[] =>
  !deck ? [] : deck.sprites?.length ? deck.sprites.slice(0, 2) : deckSprites(deck.archetype)

/** Your side of a game: the sprites it was saved with, else its deck's, else the Pokémon the parser saw. */
export const gameSprites = (
  game: { my_sprites?: string[] | null; my_archetype?: string | null },
  deck: { sprites?: string[] | null; archetype: string | null } | null | undefined,
): string[] => (game.my_sprites?.length ? game.my_sprites : deck ? spritesOf(deck) : deckSprites(game.my_archetype))

export const sameSprites = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i])
