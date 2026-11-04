import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeckGame } from './deckstats'

const PAGE = 1000

/** The games played with one deck's versions (or with any deck when `line` is left out), a page at a time. */
export async function deckGames(supabase: SupabaseClient, line?: { lineId: string }): Promise<DeckGame[]> {
  const out: DeckGame[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('games').select(`deck_id, result, went_first, opp_archetype, played_at${line ? ', decks!inner(line_id)' : ''}`)
      .not('deck_id', 'is', null).order('played_at', { ascending: false }).range(from, from + PAGE - 1)
    if (line) q = q.eq('decks.line_id', line.lineId)
    const { data, error } = await q
    if (error) throw error
    out.push(...(data as unknown as DeckGame[]).map(({ deck_id, result, went_first, opp_archetype, played_at }) => ({ deck_id, result, went_first, opp_archetype, played_at })))
    if (data.length < PAGE) return out
  }
}
