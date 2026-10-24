// Builds public/cards.json, the card index the deckbuilder searches, from PokemonTCG/pokemon-tcg-data.
// Standard-era sets only (Scarlet & Violet on). Run: node scripts/build-cards.mjs
import { writeFileSync } from 'node:fs'

const RAW = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master'
const MARKS = new Set(['H', 'I', 'J', 'K', 'L'])
const get = async (p) => {
  const r = await fetch(`${RAW}/${p}`)
  if (!r.ok) throw new Error(`${p}: ${r.status}`)
  return r.json()
}

const sets = (await get('sets/en.json')).filter((s) => /^(sv|me|zsv|rsv)/.test(s.id))
// TCG Live / Limitless codes where the data's ptcgoCode differs
const CODE = { svp: 'SVP', mep: 'MEP' }
const cards = []
for (const s of sets) {
  const code = CODE[s.id] ?? s.ptcgoCode
  if (!code) continue
  let list
  try { list = await get(`cards/en/${s.id}.json`) } catch { continue }
  for (const c of list) {
    const basicEnergy = c.supertype === 'Energy' && c.subtypes?.includes('Basic')
    if (!basicEnergy && !MARKS.has(c.regulationMark)) continue
    cards.push({
      n: c.name,
      s: code,
      no: c.number,
      t: c.supertype === 'Pokémon' ? 'P' : c.supertype === 'Trainer' ? 'T' : 'E',
      st: (c.subtypes ?? []).join(' '),
      ...(c.evolvesFrom ? { ef: c.evolvesFrom } : {}),
    })
  }
  console.log(s.id, code, cards.length)
}
writeFileSync(new URL('../public/cards.json', import.meta.url), JSON.stringify(cards))
