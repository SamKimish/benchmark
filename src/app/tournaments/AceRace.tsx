import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ACE_CP, seasonLabel, type SeasonCP } from '@/lib/tournaments'

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })

/**
 * Race to the Ace: the season's Championship Points as a track to 200, one segment per event that
 * earned them, so you can see which events got you there.
 */
export default function AceRace({ s }: { s: SeasonCP }) {
  const scale = Math.max(ACE_CP, s.total)
  const left = Math.max(0, ACE_CP - s.total)
  const done = left === 0
  return (
    <section className={`ace${done ? ' done' : ''}`} aria-label={`Race to the Ace, ${seasonLabel(s.season)}`}>
      <div className="ace-head">
        <div>
          <div className="ace-eyebrow">Race to the Ace <span aria-hidden>·</span> {seasonLabel(s.season)}</div>
          <div className="ace-score">
            <span className="ace-n">{s.total}</span>
            <span className="ace-of">/ {ACE_CP} CP</span>
          </div>
        </div>
        <div className="ace-status">
          {done ? <><strong>Ace Trainer earned</strong><span className="muted small">{s.total - ACE_CP > 0 ? `${s.total - ACE_CP} CP past the line` : 'Right on the line'}</span></>
            : <><strong>{left} CP to go</strong><span className="muted small">{s.events.length ? `from ${s.events.length} ${s.events.length === 1 ? 'event' : 'events'} so far` : 'Add the CP you earn to an event to start the race'}</span></>}
        </div>
      </div>
      <div className="ace-track" role="meter" aria-valuemin={0} aria-valuemax={ACE_CP} aria-valuenow={Math.min(s.total, ACE_CP)}
        aria-valuetext={`${s.total} of ${ACE_CP} Championship Points`}>
        {[50, 100, 150].map((m) => <span key={m} className="ace-tick" style={{ left: `${(100 * m) / scale}%` }} aria-hidden />)}
        <div className="ace-fill">
          {s.events.map((e, i) => (
            <Link key={e.id} href={`/tournaments/${e.id}`} className="ace-seg" title={`${e.name}, ${shortDate(e.start_date)}: ${e.cp} CP`}
              style={{ width: `${(100 * e.cp) / scale}%`, '--i': i } as CSSProperties}>
              <span className="ace-seg-cp">{e.cp}</span>
            </Link>
          ))}
        </div>
        <span className="ace-line" style={{ left: `${(100 * ACE_CP) / scale}%` }} aria-hidden><span>Ace</span></span>
      </div>
      {s.events.length > 0 && (
        <ol className="ace-legend">
          {s.events.map((e, i) => (
            <li key={e.id} style={{ '--i': i } as CSSProperties}><span className="ace-dot" aria-hidden />{e.name} <span className="muted">+{e.cp}</span></li>
          ))}
        </ol>
      )}
    </section>
  )
}
