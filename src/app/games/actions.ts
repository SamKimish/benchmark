'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'

export interface GameEdit { deckId: string | null; oppArchetype: string | null; result: 'W' | 'L'; tags: string[] }

/** Change what a saved game is filed as: deck, opponent's deck, result and loss reasons. */
export async function updateGame(id: string, edit: GameEdit): Promise<{ error?: string }> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('games').update({
    deck_id: edit.deckId, opp_archetype: edit.oppArchetype?.trim() || null, result: edit.result,
    tags: edit.result === 'L' ? edit.tags : [],
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
