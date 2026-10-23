'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'
import { gameRow } from '@/lib/games'
import { LogError } from '@/lib/parser'

export interface UploadItem {
  log: string
  playedAt: string
  deckId: string | null
  oppArchetype: string | null
  result: 'W' | 'L' | null
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
