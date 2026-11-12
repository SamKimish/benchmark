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
// "Pokémon|Attack" for every attack or Ability that stops the opponent's Active retreating (Yveltal's Clutch,
// Mega Golisopod ex's Quadruple Hold, ...), for the "Retreat locked" loss reason. Locks on the user's own
// Pokémon ("this Pokémon can't retreat") don't count.
const locks = new Set()
// Every Pokémon with an Ability, flagged with what the Ability locks look at, for the "Ability locked" loss
// reason: e = Evolution (Stage 1 or 2), 2 = Stage 2, c = Colorless, r = Rule Box (ex, V, ...), f = Future.
const abilityMons = {}
// Cards that switch Abilities off; the rules for each live in src/lib/parser/ability-lock.ts, so new ones are listed here to add.
const ABILITY_LOCK = /(?:has|have) no Abilities/
const lockCards = new Set()
for (const s of sets) {
  const code = CODE[s.id] ?? s.ptcgoCode
  if (!code) continue
  let list
  try { list = await get(`cards/en/${s.id}.json`) } catch { continue }
  for (const c of list) {
    const basicEnergy = c.supertype === 'Energy' && c.subtypes?.includes('Basic')
    if (!basicEnergy && !MARKS.has(c.regulationMark)) continue
    for (const a of [...(c.attacks ?? []), ...(c.abilities ?? [])])
      if (/(?:Defending|that|their \w+) Pokémon can't retreat/.test(a.text ?? '')) locks.add(`${c.name}|${a.name}`)
    for (const t of [...(c.attacks ?? []), ...(c.abilities ?? [])].map((a) => a.text ?? '').concat(c.rules ?? []))
      if (ABILITY_LOCK.test(t) && !/^Search your deck for a card that has no Abilities/.test(t)) lockCards.add(c.name)
    if (c.supertype === 'Pokémon' && c.abilities?.length) {
      const sub = c.subtypes ?? []
      const f = new Set(abilityMons[c.name] ?? '')
      if (sub.includes('Stage 1') || sub.includes('Stage 2')) f.add('e')
      if (sub.includes('Stage 2')) f.add('2')
      if (c.types?.includes('Colorless')) f.add('c')
      if (sub.some((x) => ['ex', 'V', 'VSTAR', 'VMAX', 'Radiant'].includes(x))) f.add('r')
      if (sub.includes('Future')) f.add('f')
      abilityMons[c.name] = [...f].sort().join('')
    }
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
writeFileSync(new URL('../src/lib/parser/retreat-locks.json', import.meta.url), JSON.stringify([...locks].sort(), null, 1) + '\n')
const sorted = Object.fromEntries(Object.entries(abilityMons).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(new URL('../src/lib/parser/ability-mons.json', import.meta.url), JSON.stringify(sorted, null, 1) + '\n')
console.log('Ability locks in the card data:', [...lockCards].sort().join(', '))
