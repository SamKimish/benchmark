// Builds src/lib/limitless-archetypes.json from Limitless's online deck list (play.limitlesstcg.com/decks).
// Each archetype: Limitless id, display name, the Pokémon its icons show (our archetype key), and how often it's played.
// Run: node scripts/build-archetypes.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const html = await (await fetch('https://play.limitlesstcg.com/decks?game=PTCG')).text()
const out = []
for (const [, row] of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
  const deck = row.match(/<a href="\/decks\/([a-z0-9-]+)\?[^"]*">([^<]+)<\/a>/)
  if (!deck) continue
  const icons = [...row.matchAll(/pokemon\/[a-z0-9]+\/([a-z0-9-]+)\.png/g)].map((m) => m[1])
  const count = Number(row.match(/<td class="landscape-only">(\d+)<\/td>/)?.[1] ?? 0)
  const name = deck[2].replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&').trim()
  if (icons.length) out.push({ id: deck[1], name, key: icons.join(','), count })
}
if (out.length < 20) throw new Error(`only found ${out.length} archetypes; has the page changed?`)
// Limitless only lists decks from the current format, so keep archetypes that have dropped off (with no
// play count) so older games still get their names
const file = new URL('../src/lib/limitless-archetypes.json', import.meta.url)
const seen = new Set(out.map((a) => a.key))
const old = JSON.parse(readFileSync(file, 'utf8')).filter((a) => !seen.has(a.key)).map((a) => ({ ...a, count: 0 }))
writeFileSync(file, JSON.stringify([...out, ...old], null, 1) + '\n')
console.log(out.length, 'current archetypes,', old.length, 'kept from before')
