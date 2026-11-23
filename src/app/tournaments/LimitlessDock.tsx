'use client'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import type { ImportedTournament } from '@/lib/limitless'
import { parseLabsUrl } from '@/lib/limitless'
import { dateRange, kindLabel, matchResult, ordinal, recordText } from '@/lib/tournaments'
import { prettyArch } from '@/lib/format'
import Sprites from '@/components/Sprites'
import Icon from '@/components/Icon'
import Pokeball from '@/components/Pokeball'
import { KindIcon } from './KindIcon'
import { importFromLimitless, type LimitlessImport } from './actions'

export interface DeckNote { kind: 'same' | 'close' | 'new' | 'none'; name?: string; off?: number; onUse?: () => void }

const RESULT = { W: 'Win', L: 'Loss', T: 'Tie' } as const

/** The run as a row of tiles, one per round, with a gap where day two starts. */
function Ribbon({ run }: { run: ImportedTournament }) {
  return (
    <ol className="lx-ribbon" aria-label="Rounds">
      {run.rounds.map((r, i) => {
        const m = matchResult(r)
        const day2 = r.phase > 1 && (run.rounds[i - 1]?.phase ?? 1) === 1
        const who = r.special === 'bye' ? 'Bye' : `${m ? RESULT[m] : 'No result'} vs ${r.opponent || 'unknown'}${r.opp ? ` (${prettyArch(r.opp)})` : ''}`
        return (
          <li key={i} className={`lx-tile ${m ?? ''}${day2 ? ' day2' : ''}`} style={{ '--i': i } as CSSProperties} title={`Round ${i + 1}: ${who}`}>
            {day2 && <span className="lx-day2">Day 2</span>}
            <span className="lx-tile-r">{m ?? '–'}</span>
            <span className="lx-tile-n">{i + 1}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Pulling a run in from Limitless: paste your Labs player link, and the event, your list and every round
 * come back as a ticket stub while the form below fills itself in. Nothing is saved until you save.
 */
export default function LimitlessDock({ autoUrl, autoFocus, deckNote, onImport }: {
  autoUrl?: string
  autoFocus?: boolean
  deckNote: DeckNote | null
  onImport: (r: Required<Pick<LimitlessImport, 'run'>> & LimitlessImport) => void
}) {
  const [url, setUrl] = useState(autoUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<LimitlessImport | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function go(link = url) {
    if (busy) return
    if (!parseLabsUrl(link)) {
      setError("That isn't a Limitless player link. It looks like labs.limitlesstcg.com/0079/player/1664.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await importFromLimitless(link)
      if (r.error || !r.run) { setError(r.error ?? "Couldn't read that page."); return }
      setDone(r)
      onImport(r as Required<Pick<LimitlessImport, 'run'>> & LimitlessImport)
    } catch {
      setError("Couldn't reach Limitless. Try again in a minute.")
    } finally {
      setBusy(false)
    }
  }

  // a link handed over from the Tournaments page, or a bookmark: read it straight away
  const started = useRef(false)
  useEffect(() => {
    if (autoUrl && !started.current) { started.current = true; go(autoUrl) }
    else if (autoFocus) input.current?.focus()
  }, [])

  const run = done?.run
  if (run && !busy) {
    return (
      <section className="lx-dock done" aria-live="polite">
        <article className={`lx-ticket ${run.record.w > run.record.l ? 'W' : run.record.l > run.record.w ? 'L' : 'T'}`}>
          <div className="lx-main">
            <div className="lx-eyebrow"><KindIcon kind={run.kind} size={15} /> {kindLabel(run.kind)} <span aria-hidden>·</span> Imported from Limitless</div>
            <h2 className="lx-name">{run.name}</h2>
            <div className="lx-meta">
              {run.start_date && <span>{dateRange(run.start_date, run.end_date)}</span>}
              {run.location && <span>{run.location}</span>}
              <span>{run.player}</span>
            </div>
            <Ribbon run={run} />
            {deckNote && (
              <p className="lx-deck">
                {deckNote.kind === 'same' && <>Your list matches <strong>{deckNote.name}</strong> in Decks.</>}
                {deckNote.kind === 'close' && <>Your list is {deckNote.off} {deckNote.off === 1 ? 'card' : 'cards'} off <strong>{deckNote.name}</strong>, so it&apos;ll be saved to Decks as a new list.{' '}
                  <button type="button" className="link lx-use" onClick={deckNote.onUse}>Use {deckNote.name} instead</button></>}
                {deckNote.kind === 'new' && <>Your list isn&apos;t in Decks yet. It&apos;ll be saved there as a new deck.</>}
                {deckNote.kind === 'none' && <>Limitless hasn&apos;t published lists for this event, so pick your deck below.</>}
              </p>
            )}
          </div>
          <div className="lx-stub">
            {run.placement ? (
              <div className="lx-place"><span className="lx-place-n">{run.placement}</span><span className="lx-place-s">{ordinal(run.placement).replace(String(run.placement), '')}</span></div>
            ) : <div className="lx-place"><span className="lx-place-n">–</span></div>}
            {run.players && <div className="lx-of">of {run.players.toLocaleString('en-GB')}</div>}
            <div className="lx-rec" title="Wins-losses-ties">{recordText(run.record)}</div>
            <Sprites arch={run.my_archetype} />
            {run.day2 && <span className="lx-badge">Day 2</span>}
          </div>
        </article>
        <div className="lx-after">
          {done.existing && (
            <span className="lx-warn">You&apos;ve already logged <Link href={`/tournaments/${done.existing.id}`}>{done.existing.name}</Link>. Saving adds it again.</span>
          )}
          <span className="muted small">Limitless only has match results, so each round starts as one game. Add the rest of your games below.</span>
          <span className="lx-links">
            <a href={run.source} target="_blank" rel="noreferrer" className="lx-link">Open on Limitless <Icon name="external" size={14} /></a>
            <button type="button" className="link lx-link" onClick={() => { setDone(null); setUrl(''); setTimeout(() => input.current?.focus(), 0) }}>Import another</button>
          </span>
        </div>
      </section>
    )
  }

  return (
    <section className={`lx-dock${busy ? ' busy' : ''}${error ? ' has-error' : ''}`}>
      <div className="lx-intro">
        <span className="lx-glyph" aria-hidden><Icon name="link" size={20} /></span>
        <div>
          <h2 className="lx-title">Played it on Limitless?</h2>
          <p className="muted">Paste your player page from <strong>labs.limitlesstcg.com</strong> and the event, your list and every round fill themselves in. You check it, then save.</p>
        </div>
      </div>
      <form className="lx-field" onSubmit={(e) => { e.preventDefault(); go() }}>
        <Icon name="link" size={18} />
        <input ref={input} type="url" inputMode="url" aria-label="Limitless player link" value={url} disabled={busy}
          placeholder="labs.limitlesstcg.com/0079/player/1664" spellCheck={false} autoComplete="off"
          onChange={(e) => { setUrl(e.target.value); setError(null) }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (parseLabsUrl(text)) { e.preventDefault(); setUrl(text.trim()); go(text.trim()) }
          }} />
        <button type="submit" disabled={busy || !url.trim()}>{busy ? <Pokeball size={18} label="Reading…" /> : <>Import</>}</button>
      </form>
      {busy && <ol className="lx-ribbon skeleton" aria-hidden>{Array.from({ length: 9 }, (_, i) => <li key={i} className="lx-tile" style={{ '--i': i } as CSSProperties} />)}</ol>}
      {error && <p className="error lx-error" role="alert">{error}</p>}
    </section>
  )
}
