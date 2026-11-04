import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeckGame } from './deckstats'

const PAGE = 1000

/** The games played with these decks (all of them when `deckIds` is left out), a page at a time. */
export async function deckGames(supabase: SupabaseClient, deckIds?: string[]): Promise<DeckGame[]> {
  if (deckIds && !deckIds.length) return []
  const out: DeckGame[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('games').select('deck_id, result, went_first, opp_archetype, played_at')
      .not('deck_id', 'is', null).order('played_at', { ascending: false }).range(from, from + PAGE - 1)
    if (deckIds) q = q.in('deck_id', deckIds)
    const { data, error } = await q
    if (error) throw error
    out.push(...(data as DeckGame[]))
    if (data.length < PAGE) return out
  }
}
