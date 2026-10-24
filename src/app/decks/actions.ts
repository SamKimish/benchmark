'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'

export interface DeckInput {
  id?: string
  name: string
  version: string
  version_order: number
  archetype: string | null
  decklist: string
  basics: number | null
  active: boolean
}

export async function saveDeck(d: DeckInput): Promise<{ id?: string; error?: string }> {
  const { supabase } = await requireUser()
  const { id, ...row } = d
  if (!row.name.trim()) return { error: 'Give the deck a name.' }
  const q = id ? supabase.from('decks').update(row).eq('id', id) : supabase.from('decks').insert(row)
  const { data, error } = await q.select('id').single()
  if (error) return { error: error.message }
  revalidatePath('/decks')
  revalidatePath('/upload')
  return { id: data.id }
}

export async function deleteDeck(id: string) {
  const { supabase } = await requireUser()
  await supabase.from('decks').delete().eq('id', id)
  revalidatePath('/decks')
}
