import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import { knownTagsFrom } from '@/lib/tags'
import type { Deck, Game } from '@/lib/types'
import GameView from './GameView'

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireUser()
  const [{ data: g }, { data: decks }, { data: tagRows }] = await Promise.all([
    supabase.from('games').select('*').eq('id', id).maybeSingle(),
    supabase.from('decks').select('*').order('name').order('version_order', { ascending: false }),
    supabase.from('games').select('tags, win_tags').limit(5000),
  ])
  if (!g) notFound()
  return <GameView game={g as Game} decks={decks as Deck[]} knownTags={knownTagsFrom(tagRows ?? [])} />
}

