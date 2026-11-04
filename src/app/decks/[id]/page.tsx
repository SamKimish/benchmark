import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import { deckGames } from '@/lib/deckgames'
import type { Deck } from '@/lib/types'
import DeckEditor from '../DeckEditor'
import DeckStats from '../DeckStats'

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === 'new') return <DeckEditor />
  const { supabase } = await requireUser()
  const { data } = await supabase.from('decks').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const deck = data as Deck
  const { data: line } = await supabase.from('decks').select('*').eq('line_id', deck.line_id).order('version_order', { ascending: false })
  const versions = (line ?? []) as Deck[]
  const newest = versions[0]
  const games = await deckGames(supabase, versions.map((v) => v.id))
  return (
    <DeckEditor key={deck.id} deck={deck} latest={newest ?? undefined} gameCount={games.length}
      stats={<DeckStats deck={deck} versions={versions} games={games} />} />
  )
}
