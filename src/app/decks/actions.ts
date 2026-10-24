'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'
import { diffEntries, parseDecklist } from '@/lib/decklist'
import type { Deck } from '@/lib/types'

export interface DeckInput {
  id?: string
  name: string
  archetype: string | null
  decklist: string
  basics: number | null
  active: boolean
}

const refresh = () => { revalidatePath('/decks'); revalidatePath('/upload'); revalidatePath('/') }

/**
 * Saves a deck. A new deck starts at v1. Changing an existing deck's list saves a new version, which
 * retires the one before it so its games keep the list they were played with.
 */
export async function saveDeck(d: DeckInput): Promise<{ id?: string; version?: string; newVersion?: boolean; error?: string }> {
  const { supabase } = await requireUser()
  const { id, ...row } = d
  if (!row.name.trim()) return { error: 'Give the deck a name.' }

  if (!id) {
    const { data, error } = await supabase.from('decks').insert({ ...row, version: 'v1', version_order: 1 }).select('id, version').single()
    return error ? { error: error.message } : { id: data.id, version: data.version }
  }

  const { data: current, error: e1 } = await supabase.from('decks').select('*').eq('id', id).single()
  if (e1) return { error: e1.message }
  const deck = current as Deck

  // only the cards make a new version; a different printing of the same card does not
  if (!diffEntries(parseDecklist(deck.decklist), parseDecklist(row.decklist)).length) {
    const { error } = await supabase.from('decks').update(row).eq('id', id)
    if (error) return { error: error.message }
    refresh()
    return { id, version: deck.version }
  }

  const { data: siblings } = await supabase.from('decks').select('version_order').eq('line_id', deck.line_id)
  const next = Math.max(...(siblings ?? []).map((s) => s.version_order), deck.version_order) + 1
  const { data, error } = await supabase
    .from('decks')
    .insert({ ...row, line_id: deck.line_id, version: `v${next}`, version_order: next })
    .select('id, version')
    .single()
  if (error) return { error: error.message }
  await supabase.from('decks').update({ active: false }).eq('line_id', deck.line_id).neq('id', data.id)
  refresh()
  return { id: data.id, version: data.version, newVersion: true }
}

/** Deletes a deck and all its versions. Its games are kept, without a deck. */
export async function deleteDeck(lineId: string) {
  const { supabase } = await requireUser()
  await supabase.from('decks').delete().eq('line_id', lineId)
  refresh()
}

/** Every version of a deck's list, oldest first. */
export async function deckHistory(lineId: string): Promise<Deck[]> {
  const { supabase } = await requireUser()
  const { data } = await supabase.from('decks').select('*').eq('line_id', lineId).order('version_order')
  return (data ?? []) as Deck[]
}
