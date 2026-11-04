import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import { normaliseRounds, type Tournament } from '@/lib/tournaments'
import type { Deck } from '@/lib/types'
import TournamentEditor from '../../TournamentEditor'

export default async function EditTournament({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireUser()
  const [{ data: t }, { data: decks }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
    supabase.from('decks').select('*').order('name').order('version_order', { ascending: false }),
  ])
  if (!t) notFound()
  return <TournamentEditor t={{ ...(t as Tournament), rounds: normaliseRounds(t.rounds) }} decks={(decks ?? []) as Deck[]} />
}
