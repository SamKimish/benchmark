'use client'
import { useState } from 'react'
import { deckLabel, prettyArch } from '@/lib/format'
import type { Deck } from '@/lib/types'
import Icon from './Icon'
import Pokeball from './Pokeball'
import Sprites from './Sprites'
import DeckPicker from './DeckPicker'

export interface GameFields { deckId: string; oppArchetype: string; result: 'W' | 'L' | null; tags: string[]; winTags: string[] }
/** The reasons offered in the pop-up, most used first. */
export interface KnownTags { loss: string[]; win: string[] }

/** Reasons as toggles (most used first), plus a small "+ New" to add one of your own. */
function TagPicker({ value, known, onChange, good, label, example }: {
  value: string[]; known: string[]; onChange: (tags: string[]) => void; good?: boolean; label: string; example: string
}) {
  const [adding, setAdding] = useState(false)
  const [more, setMore] = useState(false)
  const [text, setText] = useState('')
  // the chosen tags plus the most used ones; the rest wait behind "More"
  const all = [...new Set([...known, ...value])]
  const shown = more ? all : all.filter((t, i) => i < 6 || value.includes(t))
  const hidden = all.length - shown.length
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])
  function add() {
    const t = text.trim().replace(/\s+/g, ' ')
    if (t && !value.includes(t)) onChange([...value, t[0].toUpperCase() + t.slice(1)])
    setText('')
    setAdding(false)
  }
  return (
    <div className={`tag-picker${good ? ' good' : ''}`} role="group" aria-label={label}>
      {shown.map((t) => (
        <button key={t} type="button" className={`tag-toggle${value.includes(t) ? ' on' : ''}`} aria-pressed={value.includes(t)} onClick={() => toggle(t)}>{t}</button>
      ))}
      {hidden > 0 && <button type="button" className="tag-toggle tag-add" onClick={() => setMore(true)}>More ({hidden})</button>}
      {adding ? (
        <input className="tag-new" autoFocus value={text} placeholder={example} maxLength={40}
          onChange={(e) => setText(e.target.value)} onBlur={add}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); add() } if (e.key === 'Escape') { setText(''); setAdding(false) } }} />
      ) : (
        <button type="button" className="tag-toggle tag-add" onClick={() => setAdding(true)}>+ New</button>
      )}
    </div>
  )
}

/**
 * The pop-up for one game, used both to add a pasted game and to edit a saved one: deck, opponent's
 * deck, result and loss reasons. Enter saves, Esc closes.
 */
export default function GameDialog({ title, info, initial, myArch, decks, knownTags, saveLabel, onSave, onClose, children }: {
  title?: string
  /** a line under the result, e.g. 'vs Rival99 · went 2nd · prizes 3–6' */
  info: string
  initial: GameFields
  myArch?: string | null
  decks: Deck[]
  knownTags: KnownTags
  saveLabel: string
  onSave: (f: GameFields) => Promise<string | undefined>
  onClose: () => void
  children?: React.ReactNode
}) {
  const [f, setF] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const choices = decks.filter((d) => d.active || d.id === f.deckId)
  const arch = decks.find((d) => d.id === f.deckId)?.archetype ?? myArch

  async function save() {
    if (!f.result || saving) return
    setSaving(true)
    setError(null)
    try {
      const err = await onSave(f)
      if (err) setError(err)
    } catch (e) {
      setError(`Couldn't save: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && !(e.target as HTMLElement).closest('textarea, select, button')) save() }}>
      <div className="modal panel" role="dialog" aria-label={title ?? 'Game'}>
        {title && <h2 className="modal-title">{title}</h2>}
        <div className={`match ${f.result ?? 'none'} modal-match`}>
          <Sprites arch={arch} />
          <span className="match-main">
            <strong>{f.result === 'W' ? 'Win' : f.result === 'L' ? 'Loss' : 'Result?'} vs {prettyArch(f.oppArchetype)}</strong>
            <span className="muted small">{info}</span>
          </span>
          <Sprites arch={f.oppArchetype} />
        </div>
        <div className="form modal-fields">
          <label>Your deck
            <select value={f.deckId} onChange={(e) => setF({ ...f, deckId: e.target.value })}>
              <option value="">No deck</option>
              {choices.map((d) => <option key={d.id} value={d.id}>{deckLabel(d)}</option>)}
            </select>
          </label>
          <DeckPicker label="Opponent's deck" value={f.oppArchetype} onChange={(k) => setF({ ...f, oppArchetype: k })} />
          <div className="seg" role="group" aria-label="Result">
            {(['W', 'L'] as const).map((r) => (
              <button key={r} type="button" className={f.result === r ? `on ${r}` : ''} onClick={() => setF({ ...f, result: r })}>{r === 'W' ? 'Win' : 'Loss'}</button>
            ))}
            {!initial.result && <span className="muted small">The log was cut off, so pick the result.</span>}
          </div>
          <div>
            <span className="reason-label good">What went right</span>
            <TagPicker good label="Win reasons" example="e.g. Good prizing" value={f.winTags} known={knownTags.win} onChange={(winTags) => setF({ ...f, winTags })} />
          </div>
          <div>
            <span className="reason-label">What went wrong</span>
            <TagPicker label="Loss reasons" example="e.g. Bad prizing" value={f.tags} known={knownTags.loss} onChange={(tags) => setF({ ...f, tags })} />
          </div>
          {children}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={save} disabled={saving || !f.result}>
            {saving ? <Pokeball size={18} label="Saving…" /> : <><Icon name="save" /> {saveLabel}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

/** "Are you sure?" for things that can't be undone. */
export function ConfirmDialog({ title, body, confirm, onConfirm, onClose }: {
  title: string; body: React.ReactNode; confirm: string; onConfirm: () => Promise<string | undefined>; onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function go() {
    setBusy(true)
    const err = await onConfirm().catch((e) => (e instanceof Error ? e.message : 'unknown error'))
    setBusy(false)
    if (err) setError(err)
  }
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal panel confirm-modal" role="alertdialog" aria-label={title}>
        <h2 className="modal-title">{title}</h2>
        <div>{body}</div>
        {error && <p className="error">{error}</p>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="secondary" onClick={onClose} autoFocus>Cancel</button>
          <button className="danger" onClick={go} disabled={busy}>{busy ? <Pokeball size={18} label="Deleting…" /> : <><Icon name="trash" /> {confirm}</>}</button>
        </div>
      </div>
    </div>
  )
}
