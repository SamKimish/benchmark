/**
 * Import games exported from Training Court's `logs` table into Benchmark.
 *
 *   npx tsx scripts/import-training-court.ts --user <benchmark auth user id> logs.json [more.json ...]
 *
 * Each JSON file is an array of Training Court log rows (id, created_at, log, archetype, opp_archetype,
 * result, decklist_id). Decks are created from src/lib/training-court-decks.json when missing.
 * Training Court's own result and opponent deck labels are kept, since they were set by hand.
 * Re-running is safe: games already saved are skipped. Needs NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in the environment (e.g. `node --env-file=.env.local`).
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { gameRow } from '../src/lib/games'

interface TcLog { id: string; created_at: string; log: string; archetype: string; opp_archetype: string | null; result: 'W' | 'L' | null; decklist_id: string | null }
interface DeckSpec { name: string; version: string; version_order: number; archetype: string; basics?: number; active?: boolean; match: [string, string | null][] }

const args = process.argv.slice(2)
const ui = args.indexOf('--user')
if (ui < 0 || !args[ui + 1]) throw new Error('pass --user <benchmark user id>')
const userId = args[ui + 1]
const files = args.filter((_, i) => i !== ui && i !== ui + 1)
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const specs: DeckSpec[] = JSON.parse(readFileSync(new URL('../src/lib/training-court-decks.json', import.meta.url), 'utf8')).decks
const { data: existing, error } = await db.from('decks').select('id, name, version').eq('user_id', userId)
if (error) throw error
const deckFor = new Map<string, { id: string; archetype: string }>()
for (const { match, ...spec } of specs) {
  let id = existing.find((d) => d.name === spec.name && d.version === spec.version)?.id
  if (!id) {
    const { data, error } = await db.from('decks').insert({ ...spec, user_id: userId }).select('id').single()
    if (error) throw error
    id = data.id
    console.log('created deck', spec.name, spec.version)
  }
  for (const [arch, list] of match) deckFor.set(`${arch}|${list}`, { id: id!, archetype: spec.archetype })
}

const logs: TcLog[] = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')))
const rows = []
let failed = 0
for (const l of logs) {
  const deck = deckFor.get(`${l.archetype}|${l.decklist_id}`)
  try {
    const r = gameRow(l.log, deck?.archetype ?? l.archetype)
    rows.push({
      ...r, user_id: userId, deck_id: deck?.id ?? null, played_at: l.created_at,
      result: l.result ?? r.result, opp_archetype: l.opp_archetype || r.opp_archetype,
      source: 'training-court', source_id: l.id,
    })
  } catch (e) {
    failed++
    console.warn('skipped', l.id, String(e))
  }
}
let saved = 0
for (let i = 0; i < rows.length; i += 200) {
  const { data, error } = await db.from('games').upsert(rows.slice(i, i + 200), { onConflict: 'user_id,log_hash', ignoreDuplicates: true }).select('id')
  if (error) throw error
  saved += data.length
}
console.log(`${logs.length} logs: ${saved} saved, ${rows.length - saved} already there, ${failed} unreadable`)
