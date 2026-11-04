'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'
import { diffEntries, parseDecklist } from '@/lib/decklist'
import { deckSprites, sameSprites, spritesOf } from '@/lib/archetypes'
import type { Deck } from '@/lib/types'

export interface DeckInput {
  id?: string
  name: string
  archetype: string | null
  decklist: string
  basics: number | null
  active: boolean
  /** up to two Pokémon slugs; shared by every version, so changing them is never a new version */
  /** left out: the archetype's for a new deck, unchanged for an existing one */
  sprites?: string[]
}

/** When a deck's sprites change, whether its games played so far change with them or keep the old ones. */
export type PastGames = 'update' | 'keep'

const refresh = () => { revalidatePath('/decks'); revalidatePath('/upload'); revalidatePath('/') }

/**
 * Saves a deck. A new deck starts at v1. Changing an existing deck's list saves a new version, which
 * retires the one before it so its games keep the list they were played with.
 */
export async function saveDeck(d: DeckInput, pastGames: PastGames = 'keep'): Promise<{ id?: string; version?: string; newVersion?: boolean; error?: string }> {
  const { supabase } = await requireUser()
  const { id, ...row } = d
  if (!row.name.trim()) return { error: 'Give the deck a name.' }
  if (row.sprites) row.sprites = [...new Set(row.sprites.filter(Boolean))].slice(0, 2)

  if (!id) {
    const { data, error } = await supabase.from('decks').insert({ ...row, sprites: row.sprites ?? deckSprites(row.archetype), version: 'v1', version_order: 1 }).select('id, version').single()
    return error ? { error: error.message } : { id: data.id, version: data.version }
  }

  const { data: current, error: e1 } = await supabase.from('decks').select('*').eq('id', id).single()
  if (e1) return { error: e1.message }
  const deck = current as Deck
  if (row.sprites) {
    const spritesError = await updateSprites(deck, row.sprites, pastGames)
    if (spritesError) return { error: spritesError }
  }

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

/**
 * New sprites for every version of a deck. Its games either take the new sprites too, or keep showing
 * the ones they had: games saved before sprites were stored get the old ones written down.
 */
async function updateSprites(deck: Deck, sprites: string[], pastGames: PastGames): Promise<string | undefined> {
  const old = spritesOf(deck)
  if (sameSprites(old, sprites) && sameSprites(deck.sprites ?? [], sprites)) return
  const { supabase } = await requireUser()
  const { data: line, error } = await supabase.from('decks').update({ sprites }).eq('line_id', deck.line_id).select('id')
  if (error) return error.message
  if (sameSprites(old, sprites)) return   // only stored what was already shown
  const ids = (line ?? []).map((x) => x.id as string)
  const games = pastGames === 'update'
    ? supabase.from('games').update({ my_sprites: sprites }).in('deck_id', ids)
    : supabase.from('games').update({ my_sprites: old }).in('deck_id', ids).eq('my_sprites', '{}')
  const { error: e2 } = await games
  return e2?.message
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
