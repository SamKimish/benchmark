'use client'
import { createContext, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
import { prettyArch } from '@/lib/format'
import type { Deck } from '@/lib/types'
import { deleteGame, updateGame } from '@/app/games/actions'
import GameDialog, { ConfirmDialog, type KnownTags } from './GameDialog'
import Icon from './Icon'

export interface EditRow {
  id: string; deck_id: string | null; opp_archetype: string | null; result: 'W' | 'L' | null; tags: string[]; win_tags: string[]
  went_first: boolean | null; opponent: string | null; prizes_taken: number; prizes_given: number
}

const Ctx = createContext<{ edit: (r: EditRow) => void; remove: (r: EditRow) => void } | null>(null)

/** One edit pop-up and one delete confirmation shared by every row of the match log. */
export function MatchEditor({ decks, knownTags, children }: { decks: Deck[]; knownTags: KnownTags; children: React.ReactNode }) {
  const router = useRouter()
  const [editing, setEditing] = useState<EditRow | null>(null)
  const [removing, setRemoving] = useState<EditRow | null>(null)
  const title = (r: EditRow) => `${r.result === 'W' ? 'Win' : r.result === 'L' ? 'Loss' : 'Game'} vs ${prettyArch(r.opp_archetype)}`
  return (
    <Ctx.Provider value={{ edit: setEditing, remove: setRemoving }}>
      {children}
      {editing && (
        <GameDialog key={editing.id} title="Edit game" saveLabel="Save changes" decks={decks} knownTags={knownTags} onClose={() => setEditing(null)}
          info={`${editing.opponent ? `vs ${editing.opponent} · ` : ''}${editing.went_first === null ? '' : editing.went_first ? 'went 1st · ' : 'went 2nd · '}prizes ${editing.prizes_taken}–${editing.prizes_given}`}
          initial={{ deckId: editing.deck_id ?? '', oppArchetype: editing.opp_archetype ?? '', result: editing.result, tags: editing.tags, winTags: editing.win_tags }}
          onSave={async (f) => {
            const r = await updateGame(editing.id, { deckId: f.deckId || null, oppArchetype: f.oppArchetype || null, result: f.result!, tags: f.tags, winTags: f.winTags })
            if (r.error) return r.error
            setEditing(null)
            router.refresh()
          }} />
      )}
      {removing && (
        <ConfirmDialog title="Delete this game?" confirm="Delete game" onClose={() => setRemoving(null)}
          body={<p><strong>{title(removing)}</strong> will be removed from your match log and stats. This can&apos;t be undone.</p>}
          onConfirm={async () => {
            const r = await deleteGame(removing.id)
            if (r.error) return r.error
            setRemoving(null)
            router.refresh()
          }} />
      )}
    </Ctx.Provider>
  )
}

export function RowActions({ row }: { row: EditRow }) {
  const ctx = useContext(Ctx)
  if (!ctx) return null
  return (
    <span className="row-actions">
      <button type="button" className="icon-btn" onClick={() => ctx.edit(row)} title="Edit this game" aria-label="Edit this game"><Icon name="edit" size={17} /></button>
      <button type="button" className="icon-btn danger-hover" onClick={() => ctx.remove(row)} title="Delete this game" aria-label="Delete this game"><Icon name="trash" size={17} /></button>
    </span>
  )
}
