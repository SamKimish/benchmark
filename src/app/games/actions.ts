'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'
import { gameRow, PARSER_VERSION } from '@/lib/games'
import { baseArchetype, isHammer } from '@/lib/parser'
import { prettyArch } from '@/lib/format'

export interface GameEdit { deckId: string | null; oppArchetype: string | null; result: 'W' | 'L'; tags: string[]; winTags: string[] }

/** Change what a saved game is filed as: deck, opponent's deck, result, and loss and win reasons. */
export async function updateGame(id: string, edit: GameEdit): Promise<{ error?: string }> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('games').update({
    deck_id: edit.deckId, opp_archetype: edit.oppArchetype?.trim() || null, result: edit.result,
    tags: edit.tags, win_tags: edit.winTags,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

export async function deleteGame(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('games').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((t) => b.includes(t))

/**
 * Run saved games through the current parser again, a batch at a time: new stats and win reasons,
 * and the Hammer version of opponents' decks. Anything the user chose by hand (loss reasons, the
 * opponent's deck) is kept; only the parser's own guesses are replaced.
 */
export async function reanalyseGames(): Promise<{ done: number; left: number; error?: string }> {
  const { supabase } = await requireUser()
  const [{ data: decks }, { data: games, error }] = await Promise.all([
    supabase.from('decks').select('id, archetype'),
    supabase.from('games').select('id, log, deck_id, result, tags, opp_archetype, stats')
      .lt('parser_version', PARSER_VERSION).limit(100),
  ])
  if (error) return { done: 0, left: 0, error: error.message }
  const arch = new Map((decks ?? []).map((d) => [d.id, d.archetype as string | null]))
  const failed: string[] = []
  for (let i = 0; i < (games ?? []).length; i += 20) {
    await Promise.all(games!.slice(i, i + 20).map(async (g) => {
      let r
      try { r = gameRow(g.log, g.deck_id ? arch.get(g.deck_id) : undefined) } catch {
        // a log the parser can't read any more: mark it done so it isn't retried forever
        await supabase.from('games').update({ parser_version: PARSER_VERSION }).eq('id', g.id)
        return
      }
      const old = (g.stats ?? {}) as { tags?: string[]; opp_archetype?: string | null }
      const handTagged = g.result === 'L' && !sameSet(g.tags ?? [], old.tags ?? [])
      const opp = g.opp_archetype as string | null
      const hammerOf = isHammer(r.opp_archetype) && !isHammer(opp) && prettyArch(baseArchetype(r.opp_archetype)) === prettyArch(opp)
      const { error } = await supabase.from('games').update({
        my_archetype: r.my_archetype,
        opp_archetype: hammerOf || !opp || opp === old.opp_archetype ? r.opp_archetype : opp,
        tags: handTagged ? g.tags : r.tags,
        win_tags: r.win_tags,
        end_reason: r.end_reason,
        stats: r.stats,
        parser_version: PARSER_VERSION,
      }).eq('id', g.id)
      if (error) failed.push(error.message)
    }))
  }
  if (failed.length) return { done: 0, left: 0, error: failed[0] }
  const { count } = await supabase.from('games').select('id', { count: 'exact', head: true }).lt('parser_version', PARSER_VERSION)
  revalidatePath('/')
  return { done: games?.length ?? 0, left: count ?? 0 }
}
