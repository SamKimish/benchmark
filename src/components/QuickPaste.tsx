'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { gameStats, LogError, type GameStats } from '@/lib/parser'
import { deckLabel, prettyArch } from '@/lib/format'
import type { Deck } from '@/lib/types'
import { saveGames } from '@/app/upload/actions'
import Icon from './Icon'
import Pokeball from './Pokeball'
import Sprites from './Sprites'

interface Draft { log: string; stats: GameStats; deckId: string; oppArchetype: string; result: 'W' | 'L' | null }

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
export default function QuickPaste({ decks, lastDeckId }: { decks: Deck[]; lastDeckId: string | null }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [manual, setManual] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const text = useRef<HTMLTextAreaElement>(null)
  const choices = decks.filter((d) => d.active || d.id === draft?.deckId)

  const load = useCallback((log: string) => {
    setError(null)
    try {
      const stats = gameStats(log)
      setDraft({ log, stats, deckId: guessDeck(decks, stats.my_archetype, lastDeckId), oppArchetype: stats.opp_archetype ?? '', result: stats.result })
      setManual(false)
    } catch (e) {
      setDraft(null)
      setManual(true)
      setError(e instanceof LogError ? `That doesn't look like a TCG Live game log: ${e.message}` : "That doesn't look like a TCG Live game log.")
    }
  }, [decks, lastDeckId])

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

  async function save() {
    if (!draft || !draft.result) return
    setSaving(true)
    try {
      const r = await saveGames([{ log: draft.log, playedAt: new Date().toISOString(), deckId: draft.deckId || null, oppArchetype: draft.oppArchetype || null, result: draft.result }])
      if (r.errors.length) { setError(r.errors[0]); return }
      setToast(r.duplicates ? 'That game was already saved.' : `Saved: ${draft.result === 'W' ? 'win' : 'loss'} vs ${prettyArch(draft.oppArchetype)}.`)
      close()
      router.refresh()
    } catch (e) {
      setError(`Couldn't save: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const open = draft || manual
  return (
    <>
      <button className="paste-game" onClick={fromClipboard} title="Copy a game log in TCG Live, then click here or press Ctrl+V">
        <Icon name="paste" size={18} /> Paste game
      </button>
      {toast && <div className="toast" role="status">{toast}</div>}
      {open && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && close()}
          onKeyDown={(e) => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && draft && !(e.target as HTMLElement).closest('textarea')) save() }}>
          <div className="modal panel" role="dialog" aria-label="Add a game">
            {draft ? (
              <>
                <div className={`match ${draft.result ?? 'none'} modal-match`}>
                  <Sprites arch={decks.find((d) => d.id === draft.deckId)?.archetype ?? draft.stats.my_archetype} />
                  <span className="match-main">
                    <strong>{draft.result === 'W' ? 'Win' : draft.result === 'L' ? 'Loss' : 'Result?'} vs {prettyArch(draft.oppArchetype)}</strong>
                    <span className="muted small">vs {draft.stats.opponent} · {draft.stats.went_first === null ? '' : draft.stats.went_first ? 'went 1st · ' : 'went 2nd · '}prizes {draft.stats.prizes_taken}–{draft.stats.prizes_given}</span>
                  </span>
                  <Sprites arch={draft.oppArchetype} />
                </div>
                <div className="form modal-fields">
                  <label>Your deck
                    <select value={draft.deckId} onChange={(e) => setDraft({ ...draft, deckId: e.target.value })}>
                      <option value="">No deck</option>
                      {choices.map((d) => <option key={d.id} value={d.id}>{deckLabel(d)}</option>)}
                    </select>
                  </label>
                  <label>Opponent&apos;s deck <span className="muted small">{prettyArch(draft.oppArchetype)}</span>
                    <input value={draft.oppArchetype} onChange={(e) => setDraft({ ...draft, oppArchetype: e.target.value })} />
                  </label>
                  <div className="seg" role="group" aria-label="Result">
                    {(['W', 'L'] as const).map((r) => (
                      <button key={r} type="button" className={draft.result === r ? `on ${r}` : ''} onClick={() => setDraft({ ...draft, result: r })}>{r === 'W' ? 'Win' : 'Loss'}</button>
                    ))}
                    {!draft.stats.result && <span className="muted small">The log was cut off, so pick the result.</span>}
                  </div>
                </div>
              </>
            ) : (
              <div className="form">
                <label>Paste the game log
                  <textarea ref={text} rows={8} placeholder="In TCG Live, open the game in your history and copy the log, then paste it here." onPaste={(e) => {
                    const t = e.clipboardData.getData('text'); if (t.trim()) { e.preventDefault(); load(t) }
                  }} />
                </label>
              </div>
            )}
            {error && <p className="error">{error}</p>}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="secondary" onClick={close}>Cancel</button>
              {draft && (
                <button onClick={save} disabled={saving || !draft.result} autoFocus>
                  {saving ? <Pokeball size={18} label="Saving…" /> : <><Icon name="save" /> Save game</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
