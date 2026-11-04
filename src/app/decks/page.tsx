import { requireUser } from '@/lib/supabase/server'
import { deckGames } from '@/lib/deckgames'
import type { Tally } from '@/lib/deckstats'
import type { Deck } from '@/lib/types'
import DeckGallery from './DeckGallery'

export default async function Decks() {
  const { supabase } = await requireUser()
  const [{ data }, games] = await Promise.all([
    supabase.from('decks').select('*').order('active', { ascending: false }).order('name').order('version_order', { ascending: false }),
    deckGames(supabase),
  ])
  const decks = (data ?? []) as Deck[]
  // each deck's record across all its versions
  const line = new Map(decks.map((d) => [d.id, d.line_id]))
  const records: Record<string, Tally> = {}
  for (const g of games) {
    const l = g.deck_id && line.get(g.deck_id)
    if (!l) continue
    const r = (records[l] ??= { games: 0, wins: 0, losses: 0 })
    r.games++
    if (g.result === 'W') r.wins++
    if (g.result === 'L') r.losses++
  }
  return (
    <>
      <h1>Decks</h1>
      <DeckGallery decks={decks} records={records} />
    </>
  )
}
