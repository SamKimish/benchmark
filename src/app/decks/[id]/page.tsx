import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import type { Deck } from '@/lib/types'
import DeckEditor from '../DeckEditor'

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === 'new') return <DeckEditor />
  const { supabase } = await requireUser()
  const { data } = await supabase.from('decks').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  return <DeckEditor deck={data as Deck} />
}
