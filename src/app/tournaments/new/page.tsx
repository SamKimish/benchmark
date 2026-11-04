import { requireUser } from '@/lib/supabase/server'
import type { Deck } from '@/lib/types'
import TournamentEditor from '../TournamentEditor'

export default async function NewTournament() {
  const { supabase } = await requireUser()
  const { data } = await supabase.from('decks').select('*').order('name').order('version_order', { ascending: false })
  return <TournamentEditor decks={(data ?? []) as Deck[]} />
}
