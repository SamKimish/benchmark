'use client'
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { gameStats, LogError, type GameStats } from '@/lib/parser'
import { deckLabel, prettyArch } from '@/lib/format'
import Pokeball from '@/components/Pokeball'
import type { Deck } from '@/lib/types'
import { isTcExport, tcDeckSpec, type TcLog } from '@/lib/training-court'
import { ensureTrainingCourtDecks, saveGames, type UploadItem } from './actions'

interface Pending extends UploadItem { key: string; name: string; stats?: GameStats; error?: string }

/** A paste can hold several logs: each one starts with a "Setup" line. */
const splitLogs = (text: string) =>
  text.replace(/\r\n?/g, '\n').split(/^(?=Setup$)/m).map((s) => s.trim()).filter((s) => s.includes("'s Turn"))

const localInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16)

function pickDeck(decks: Deck[], archetype: string | null) {
  return (decks.find((d) => d.archetype && d.archetype === archetype) ?? decks[0])?.id ?? null
}

export default function UploadForm({ decks: initialDecks }: { decks: Deck[] }) {
  const [decks, setDecks] = useState(initialDecks)
  const [items, setItems] = useState<Pending[]>([])
  const [paste, setPaste] = useState('')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Awaited<ReturnType<typeof saveGames>> | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function add(logs: { log: string; name: string; at: number }[]) {
    setDone(null)
    setItems((prev) => [
      ...prev,
      ...logs.map(({ log, name, at }, i): Pending => {
        const base = { key: `${Date.now()}-${i}-${name}`, name, log, playedAt: localInput(at) }
        try {
          const s = gameStats(log)
          return { ...base, stats: s, deckId: pickDeck(decks, s.my_archetype), oppArchetype: s.opp_archetype, result: s.result }
        } catch (e) {
          return { ...base, deckId: null, oppArchetype: null, result: null, error: e instanceof LogError ? e.message : 'Could not read this log.' }
        }
      }),
    ])
  }

  /** A Training Court export: keeps its hand-set result and opponent deck, and files games under the matching deck. */
  async function addTrainingCourt(rows: TcLog[]) {
    const all = await ensureTrainingCourtDecks()
    setDecks(all)
    setDone(null)
    setItems((prev) => [
      ...prev,
      ...rows.map((r, i): Pending => {
        const at = Date.parse(r.created_at)
        const base = { key: `tc-${r.id ?? i}`, name: `Training Court game ${i + 1}`, log: r.log, playedAt: localInput(at), source: 'training-court' as const, sourceId: r.id }
        try {
          const s = gameStats(r.log)
          const spec = tcDeckSpec(r)
          const deck = spec ? all.find((d) => d.name === spec.name && d.version === spec.version) : undefined
          return { ...base, stats: s, deckId: deck?.id ?? pickDeck(all, s.my_archetype), oppArchetype: r.opp_archetype || s.opp_archetype, result: r.result ?? s.result }
        } catch (e) {
          return { ...base, deckId: null, oppArchetype: null, result: null, error: e instanceof LogError ? e.message : 'Could not read this log.' }
        }
      }),
    ])
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(`Reading ${files.length} file${files.length === 1 ? '' : 's'}…`)
    try {
      await readFiles(files)
    } catch (e) {
      setDone({ saved: 0, duplicates: 0, errors: [`Couldn't read those files: ${e instanceof Error ? e.message : 'unknown error'}`] })
    } finally {
      setBusy(null)
    }
  }

  async function readFiles(files: FileList) {
    const logs = []
    for (const f of Array.from(files)) {
      if (f.name.endsWith('.json')) {
        let rows: unknown = null
        try { rows = JSON.parse(await f.text()) } catch { /* not JSON after all */ }
        if (isTcExport(rows)) { setBusy(`Importing ${rows.length} Training Court games…`); await addTrainingCourt(rows); continue }
      }
      const parts = splitLogs(await f.text())
      parts.forEach((log, i) => logs.push({ log, name: parts.length > 1 ? `${f.name} (${i + 1})` : f.name, at: f.lastModified }))
      if (!parts.length) logs.push({ log: await f.text(), name: f.name, at: f.lastModified })
    }
    add(logs)
  }

  const update = (key: string, patch: Partial<Pending>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const ready = useMemo(() => items.filter((x) => !x.error), [items])
  const needResult = ready.some((x) => !x.result)

  async function submit() {
    setBusy(`Saving ${ready.length} game${ready.length === 1 ? '' : 's'}…`)
    try {
      // in batches, so a big import stays under the request size limit
      const res = { saved: 0, duplicates: 0, errors: [] as string[] }
      for (let i = 0; i < ready.length; i += 100) {
        const r = await saveGames(ready.slice(i, i + 100).map(({ log, playedAt, deckId, oppArchetype, result, source, sourceId }) => ({
          log, playedAt: new Date(playedAt).toISOString(), deckId, oppArchetype, result, source, sourceId,
        })))
        res.saved += r.saved
        res.duplicates += r.duplicates
        res.errors.push(...r.errors)
        if (ready.length > 100) setBusy(`Saved ${Math.min(i + 100, ready.length)} of ${ready.length} games…`)
      }
      setDone(res)
      if (!res.errors.length) setItems([])
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid" style={{ display: 'grid', gap: 16 }}>
      {!decks.length && (
        <p className="panel">You have no decks yet. <Link href="/decks">Add one</Link> so games can be filed under it (you can also upload without).</p>
      )}
      <div
        className={`drop${over ? ' over' : ''}`}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files) }}
      >
        <strong>Drop log files here</strong> <span className="muted">or click to choose</span>
        <input ref={fileInput} type="file" accept=".txt,.json,text/plain,application/json" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>
      <div className="form" style={{ maxWidth: 'none' }}>
        <label>Or paste a log<textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Setup&#10;…" /></label>
        <div><button className="secondary" disabled={!paste.trim()} onClick={() => {
          const logs = splitLogs(paste)
          add((logs.length ? logs : [paste]).map((log, i) => ({ log, name: `Pasted game ${i + 1}`, at: Date.now() })))
          setPaste('')
        }}>Add pasted log</button></div>
      </div>

      {items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Game</th><th>Played</th><th>Deck</th><th>Opponent deck</th><th>Order</th><th>Result</th><th>Prizes</th><th /></tr></thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.key}>
                    <td className="wrap">{x.name}{x.stats && <div className="muted small">vs {x.stats.opponent}</div>}</td>
                    {x.error ? <td colSpan={6} className="error wrap">{x.error}</td> : (
                      <>
                        <td><input type="datetime-local" value={x.playedAt} onChange={(e) => update(x.key, { playedAt: e.target.value })} /></td>
                        <td>
                          <select value={x.deckId ?? ''} onChange={(e) => update(x.key, { deckId: e.target.value || null })}>
                            <option value="">No deck</option>
                            {decks.map((d) => <option key={d.id} value={d.id}>{deckLabel(d)}</option>)}
                          </select>
                        </td>
                        <td>
                          <input value={x.oppArchetype ?? ''} size={18} onChange={(e) => update(x.key, { oppArchetype: e.target.value })} title={prettyArch(x.oppArchetype)} />
                        </td>
                        <td>{x.stats!.went_first === null ? '–' : x.stats!.went_first ? '1st' : '2nd'}</td>
                        <td>
                          <select value={x.result ?? ''} onChange={(e) => update(x.key, { result: (e.target.value || null) as 'W' | 'L' | null })}
                            className={x.result ? '' : 'error'}>
                            <option value="">Pick…</option><option value="W">Win</option><option value="L">Loss</option>
                          </select>
                        </td>
                        <td>{x.stats!.prizes_taken}–{x.stats!.prizes_given}</td>
                      </>
                    )}
                    <td><button className="link" onClick={() => setItems((xs) => xs.filter((y) => y.key !== x.key))}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Opponent decks are guessed from the Pokémon they played (Limitless-style names such as <code>dragapult,dusknoir</code>); fix any that look wrong.</p>
          <div className="row">
            <button onClick={submit} disabled={!!busy || !ready.length || needResult}>
              {`Save ${ready.length} game${ready.length === 1 ? '' : 's'}`}
            </button>
            {needResult && <span className="muted small">Some logs were cut off before the end, so pick their result.</span>}
          </div>
        </>
      )}
      {busy && <div className="overlay"><div className="panel"><Pokeball size={72} /><span>{busy}</span></div></div>}
      {done && (
        <p className="panel">
          Saved {done.saved} game{done.saved === 1 ? '' : 's'}{done.duplicates ? `, skipped ${done.duplicates} already saved` : ''}.{' '}
          <Link href="/">See the match log</Link>
          {done.errors.map((e) => <span key={e} className="error" style={{ display: 'block' }}>{e}</span>)}
        </p>
      )}
    </div>
  )
}
