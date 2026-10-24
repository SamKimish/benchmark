'use client'
import { diffEntries, parseDecklist, type Entry } from '@/lib/decklist'
import type { Deck } from '@/lib/types'

/** What changed from each version of a list to the next, newest first. */
export default function DeckDiff({ versions, current, onClose }: {
  versions: Deck[]
  current: { version: string; entries: Entry[] }
  onClose: () => void
}) {
  const lists = [
    ...versions.map((v) => ({ version: v.version, when: v.created_at, entries: parseDecklist(v.decklist) })),
    ...(current.version === versions[versions.length - 1]?.version ? [] : [{ version: current.version, when: '', entries: current.entries }]),
  ]
  const steps = lists.slice(1).map((v, i) => ({ ...v, changes: diffEntries(lists[i].entries, v.entries), from: lists[i].version })).reverse()

  return (
    <div className="panel history">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>Change history</strong>
        <button className="link" onClick={onClose}>Close</button>
      </div>
      {!steps.length && <p className="muted small">Only one version so far.</p>}
      {steps.map((s) => (
        <div key={s.version} className="step">
          <div className="small muted">
            {s.from} → <strong>{s.version}</strong>
            {s.when && ` · ${new Date(s.when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            {!s.when && ' · unsaved'}
          </div>
          {!s.changes.length ? <div className="small muted">No card changes.</div> : (
            <ul className="changes">
              {s.changes.map((c) => {
                const d = c.to - c.from
                return (
                  <li key={c.name} className={d > 0 ? 'add' : 'remove'}>
                    {d > 0 ? '+' : '−'}{Math.abs(d)} {c.name}
                    {c.from > 0 && c.to > 0 && <span className="muted"> ({c.from} → {c.to})</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
