'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'
import { basics, cardKey, parseDecklist } from '@/lib/decklist'
import { matchArchetypes } from '@/lib/archetypes'
import { isKind, normaliseRounds, type Round } from '@/lib/tournaments'
import type { Card } from '@/lib/decklist'
import cardData from '../../../public/cards.json'
import { saveDeck } from '../decks/actions'

export interface TournamentInput {
  id?: string
  name: string
  kind: string
  format: string
  location: string
  startDate: string
  endDate: string | null
  deckId: string | null
  myArchetype: string | null
  placement: number | null
  players: number | null
  rounds: Round[]
  notes: string
  /** a list pasted in while logging the event, saved as a new deck first */
  newDeck?: { name: string; decklist: string } | null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const count = (n: number | null) => (n && Number.isInteger(n) && n > 0 && n < 100000 ? n : null)

export async function saveTournament(t: TournamentInput): Promise<{ id?: string; error?: string }> {
  const { supabase } = await requireUser()
  if (!t.name.trim()) return { error: 'Give the tournament a name.' }
  if (!isKind(t.kind)) return { error: 'Pick a tournament type.' }
  if (!DATE.test(t.startDate)) return { error: 'Pick the date it started.' }
  const end = t.endDate && DATE.test(t.endDate) && t.endDate > t.startDate ? t.endDate : null
  const placement = count(t.placement), players = count(t.players)
  if (placement && players && placement > players) return { error: `You can't finish ${placement} of ${players} players.` }

  let deckId = t.deckId
  let arch = t.myArchetype?.trim() || null
  if (t.newDeck) {
    const index = new Map((cardData as Card[]).map((c) => [cardKey(c.s, c.no), c]))
    const entries = parseDecklist(t.newDeck.decklist, index)
    if (!entries.length) return { error: "That list didn't read as a TCG Live export. Copy it from the deck builder and paste it again." }
    // no deck picked for the event: name it from the list, the way the deck builder does
    const guess = matchArchetypes(entries.filter((e) => e.t === 'P').map((e) => e.name), 1, entries.some((e) => e.name === 'Crushing Hammer'))[0]
    arch = arch ?? guess?.key ?? null
    const r = await saveDeck({
      name: t.newDeck.name.trim() || guess?.name || t.name.trim(), archetype: arch, decklist: t.newDeck.decklist.trim(),
      basics: basics(entries, index), active: true,
    })
    if (r.error || !r.id) return { error: r.error ?? "Couldn't save the list." }
    deckId = r.id
  } else if (deckId) {
    const { data: deck } = await supabase.from('decks').select('archetype').eq('id', deckId).maybeSingle()
    if (!deck) return { error: 'That deck no longer exists.' }
    arch = deck.archetype ?? arch
  }

  const row = {
    name: t.name.trim().slice(0, 120), kind: t.kind, format: t.format.trim().slice(0, 40), location: t.location.trim().slice(0, 120),
    start_date: t.startDate, end_date: end, deck_id: deckId, my_archetype: arch, placement, players,
    rounds: normaliseRounds(t.rounds).slice(0, 30), notes: t.notes.slice(0, 5000),
  }
  const { data, error } = t.id
    ? await supabase.from('tournaments').update(row).eq('id', t.id).select('id').single()
    : await supabase.from('tournaments').insert(row).select('id').single()
  if (error) return { error: error.message }
  revalidatePath('/tournaments')
  revalidatePath(`/tournaments/${data.id}`)
  return { id: data.id }
}

export async function deleteTournament(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('tournaments').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/tournaments')
  return {}
}
