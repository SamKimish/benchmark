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
  const deck = data as Deck
  const { data: newest } = await supabase.from('decks').select('id, version, version_order')
    .eq('line_id', deck.line_id).order('version_order', { ascending: false }).limit(1).single()
  return <DeckEditor deck={deck} latest={newest ?? undefined} />
}
