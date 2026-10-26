'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { gameStats, LogError, type GameStats } from '@/lib/parser'
import { prettyArch } from '@/lib/format'
import type { Deck } from '@/lib/types'
import { saveGames } from '@/app/upload/actions'
import Icon from './Icon'
import GameDialog, { type GameFields } from './GameDialog'

interface Draft { log: string; stats: GameStats; key: number }

/** The deck a pasted game was most likely played with: the newest active version of a matching
 * archetype, else whatever the last game was played with. */
function guessDeck(decks: Deck[], arch: string | null, lastDeckId: string | null) {
  const same = (d: Deck) => d.archetype && arch && (d.archetype === arch || prettyArch(d.archetype) === prettyArch(arch))
  const hits = decks.filter(same).sort((a, b) => Number(b.active) - Number(a.active) || b.version_order - a.version_order)
  return hits[0]?.id ?? lastDeckId ?? ''
}

/**
 * Adding the game you just played: copy the log in TCG Live, press "Paste game" (or Ctrl+V anywhere
 * on the page), check the guesses, save.
 */
export default function QuickPaste({ decks, lastDeckId, knownTags }: { decks: Deck[]; lastDeckId: string | null; knownTags: string[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [manual, setManual] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const text = useRef<HTMLTextAreaElement>(null)

  const load = useCallback((log: string) => {
    setError(null)
    try {
      const stats = gameStats(log)
      setDraft({ log, stats, key: Date.now() })
      setManual(false)
    } catch (e) {
      setDraft(null)
      setManual(true)
      setError(e instanceof LogError ? `That doesn't look like a TCG Live game log: ${e.message}` : "That doesn't look like a TCG Live game log.")
    }
  }, [])

  async function fromClipboard() {
    try {
      const t = await navigator.clipboard.readText()
      if (t.trim()) return load(t)
    } catch { /* no clipboard permission: fall back to pasting by hand */ }
    setError(null)
    setManual(true)
  }

  // Ctrl+V anywhere on the page (outside a text box) does the same as the button
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
      const t = e.clipboardData?.getData('text') ?? ''
      if (t.trim()) { e.preventDefault(); load(t) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [load])

  useEffect(() => { if (manual) text.current?.focus() }, [manual])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const close = () => { setDraft(null); setManual(false); setError(null) }

  async function save(f: GameFields) {
    if (!draft || !f.result) return
    const r = await saveGames([{ log: draft.log, playedAt: new Date().toISOString(), deckId: f.deckId || null, oppArchetype: f.oppArchetype || null, result: f.result, tags: f.result === 'L' ? f.tags : [] }])
    if (r.errors.length) return r.errors[0]
    setToast(r.duplicates ? 'That game was already saved.' : `Saved: ${f.result === 'W' ? 'win' : 'loss'} vs ${prettyArch(f.oppArchetype)}.`)
    close()
    router.refresh()
  }

  const open = draft || manual
  return (
    <>
      <button className="paste-game" onClick={fromClipboard} title="Copy a game log in TCG Live, then click here or press Ctrl+V">
        <Icon name="paste" size={18} /> Paste game
      </button>
      {toast && <div className="toast" role="status">{toast}</div>}
      {draft && (
        <GameDialog key={draft.key} title="Add game" saveLabel="Save game" decks={decks} knownTags={knownTags}
          myArch={draft.stats.my_archetype} onSave={save} onClose={close}
          info={`vs ${draft.stats.opponent}${draft.stats.went_first === null ? '' : draft.stats.went_first ? ' · went 1st' : ' · went 2nd'} · prizes ${draft.stats.prizes_taken}–${draft.stats.prizes_given}`}
          initial={{
            deckId: guessDeck(decks, draft.stats.my_archetype, lastDeckId), oppArchetype: draft.stats.opp_archetype ?? '',
            result: draft.stats.result, tags: draft.stats.result === 'L' ? draft.stats.tags : [],
          }} />
      )}
      {manual && !draft && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && close()} onKeyDown={(e) => e.key === 'Escape' && close()}>
          <div className="modal panel" role="dialog" aria-label="Add a game">
            <div className="form">
              <label>Paste the game log
                <textarea ref={text} rows={8} placeholder="In TCG Live, open the game in your history and copy the log, then paste it here." onPaste={(e) => {
                  const t = e.clipboardData.getData('text'); if (t.trim()) { e.preventDefault(); load(t) }
                }} />
              </label>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="secondary" onClick={close}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
