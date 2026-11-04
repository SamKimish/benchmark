import { requireUser } from '@/lib/supabase/server'
import { normaliseRounds, type Tournament } from '@/lib/tournaments'
import TournamentList, { type DeckName } from './TournamentList'

export default async function Tournaments() {
  const { supabase } = await requireUser()
  const [{ data, error }, { data: deckData }] = await Promise.all([
    supabase.from('tournaments').select('*').order('start_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('decks').select('id, name, version, archetype'),
  ])
  const ts = ((data ?? []) as Tournament[]).map((t) => ({ ...t, rounds: normaliseRounds(t.rounds) }))
  return <TournamentList ts={ts} decks={(deckData ?? []) as DeckName[]} error={error?.message} />
}
