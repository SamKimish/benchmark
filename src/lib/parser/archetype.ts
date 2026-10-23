/**
 * Guess a deck's archetype from the Pokémon it put into play, as a Limitless-style slug
 * ('dragapult,dusknoir'). A known archetype matches when each of its Pokémon showed up, or a
 * Pokémon that evolves into it did (a game can end before Dreepy becomes Dragapult). The match
 * with the most evidence wins, then the most common one.
 */
import { cardSlug } from './text'
import { ARCHETYPES, EVOLUTIONS } from './archetypes'

// Pokémon that turn up in many decks as support, so they never name a deck on their own
const SUPPORT = new Set([
  'fezandipiti', 'meowth', 'clefairy', 'squawkabilly', 'latias', 'budew', 'shaymin', 'mew', 'iron-thorns',
  'bloodmoon-ursaluna', 'pecharunt', 'munkidori', 'dudunsparce', 'dunsparce', 'fan-rotom', 'lumineon', 'tatsugiri',
  'psyduck', 'moltres', 'chi-yu', 'hawlucha', 'kyurem', 'ogerpon-cornerstone', 'duskull', 'dusclops', 'hoothoot',
  'noctowl', 'pikipek', 'trumbeak', 'toucannon', 'lunatone', 'solrock', 'genesect', 'drilbur', 'fan-rotom',
])

const next = new Map<string, string[]>()
for (const [a, b] of EVOLUTIONS) {
  const [x, y] = [cardSlug(a), cardSlug(b)]
  if (x !== y) next.set(x, [...(next.get(x) ?? []), y])
}
function descendants(slug: string, out = new Set<string>()): Set<string> {
  for (const d of next.get(slug) ?? []) if (!out.has(d)) { out.add(d); descendants(d, out) }
  return out
}

export function detectArchetype(pokemon: string[]): string | null {
  const seen = new Set(pokemon.map(cardSlug))
  const implied = new Set<string>()
  for (const s of seen) for (const d of descendants(s)) if (!seen.has(d)) implied.add(d)
  let best: { slug: string; score: number } | null = null
  for (const [slug, prior] of ARCHETYPES) {
    let score = 0
    for (const p of slug.split(',')) {
      const w = seen.has(p) ? 1 : implied.has(p) ? 0.6 : 0
      if (!w) { score = 0; break }
      score += w * (SUPPORT.has(p) ? 0.01 : 1)
    }
    if (!score) continue
    score = score * 1000 + prior
    if (!best || score > best.score) best = { slug, score }
  }
  if (best) return best.slug
  // nothing known: name it after the last non-support Pokémon line we saw
  const last = [...pokemon].reverse().map(cardSlug).find((p) => !SUPPORT.has(p))
  if (!last) return null
  const tops = [...descendants(last)].filter((d) => !next.has(d))
  return tops.length === 1 ? tops[0] : last
}
