import { requireUser } from '@/lib/supabase/server'
import type { Deck } from '@/lib/types'
import DeckGallery from './DeckGallery'

export default async function Decks() {
  const { supabase } = await requireUser()
  const { data } = await supabase.from('decks').select('*').order('active', { ascending: false }).order('name').order('version_order', { ascending: false })
  return (
    <>
      <h1>Decks</h1>
      <DeckGallery decks={(data ?? []) as Deck[]} />
    </>
  )
}
