import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import { normaliseRounds, type Tournament } from '@/lib/tournaments'
import type { Deck } from '@/lib/types'
import TournamentView from '../TournamentView'

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireUser()
  const { data } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const t = { ...(data as Tournament), rounds: normaliseRounds(data.rounds) }
  const { data: deck } = t.deck_id ? await supabase.from('decks').select('*').eq('id', t.deck_id).maybeSingle() : { data: null }
  return <TournamentView t={t} deck={deck as Deck | null} />
}
