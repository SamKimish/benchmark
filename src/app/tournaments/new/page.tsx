import { requireUser } from '@/lib/supabase/server'
import type { Deck } from '@/lib/types'
import TournamentEditor from '../TournamentEditor'

/** /tournaments/new, or ?import to start from a Limitless link (?import=<link> reads it straight away). */
export default async function NewTournament({ searchParams }: { searchParams: Promise<{ import?: string | string[] }> }) {
  const { supabase } = await requireUser()
  const { data } = await supabase.from('decks').select('*').order('name').order('version_order', { ascending: false })
  const q = (await searchParams).import
  const link = Array.isArray(q) ? q[0] : q
  return <TournamentEditor decks={(data ?? []) as Deck[]} limitless={link === undefined ? undefined : link ? { url: link } : { focus: true }} />
}
