'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'
import { gameRow } from '@/lib/games'
import { LogError } from '@/lib/parser'
import { TC_DECKS } from '@/lib/training-court'
import type { Deck } from '@/lib/types'

export interface UploadItem {
  log: string
  playedAt: string
  deckId: string | null
  oppArchetype: string | null
  result: 'W' | 'L' | null
  source?: 'upload' | 'training-court'
  sourceId?: string
}

/** Make sure the decks that Training Court games are filed under exist, and return all decks. */
export async function ensureTrainingCourtDecks(): Promise<Deck[]> {
  const { supabase } = await requireUser()
  const { data: have } = await supabase.from('decks').select('name, version')
  const missing = TC_DECKS.filter((d) => !(have ?? []).some((h) => h.name === d.name && h.version === d.version))
  if (missing.length) {
    const { error } = await supabase.from('decks').insert(missing.map(({ match: _, ...d }) => d))
    if (error) throw new Error(error.message)
    revalidatePath('/decks')
  }
  const { data } = await supabase.from('decks').select('*').eq('active', true).order('name').order('version_order', { ascending: false })
  const { data: all } = await supabase.from('decks').select('*').eq('active', false).order('name').order('version_order', { ascending: false })
  return [...(data ?? []), ...(all ?? [])] as Deck[]
}

export async function saveGames(items: UploadItem[]): Promise<{ saved: number; duplicates: number; errors: string[] }> {
  const { supabase } = await requireUser()
  const { data: decks } = await supabase.from('decks').select('id, archetype')
  const arch = new Map((decks ?? []).map((d) => [d.id, d.archetype as string | null]))
  const rows = []
  const errors: string[] = []
  for (const [i, it] of items.entries()) {
    try {
      // parsed again here: the browser's preview is only a preview
      const r = gameRow(it.log, it.deckId ? arch.get(it.deckId) : undefined)
      rows.push({
        ...r,
        deck_id: it.deckId && arch.has(it.deckId) ? it.deckId : null,
        played_at: new Date(it.playedAt).toISOString(),
        result: it.result ?? r.result,
        opp_archetype: it.oppArchetype?.trim() || r.opp_archetype,
        source: it.source ?? 'upload',
        source_id: it.sourceId ?? null,
      })
    } catch (e) {
      errors.push(`Game ${i + 1}: ${e instanceof LogError ? e.message : 'could not be read'}`)
    }
  }
  if (!rows.length) return { saved: 0, duplicates: 0, errors }
  const { data, error } = await supabase
    .from('games')
    .upsert(rows, { onConflict: 'user_id,log_hash', ignoreDuplicates: true })
    .select('id')
  if (error) return { saved: 0, duplicates: 0, errors: [...errors, error.message] }
  revalidatePath('/')
  return { saved: data.length, duplicates: rows.length - data.length, errors }
}
