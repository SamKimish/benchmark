import Link from 'next/link'
import { pct, prettyArch } from '@/lib/format'
import {
  dateRange, matchResult, ordinal, record, recordText, seasonCP, seasonOf, type Tournament,
} from '@/lib/tournaments'
import type { Deck } from '@/lib/types'
import Sprites from '@/components/Sprites'
import { spritesOf } from '@/lib/archetypes'
import Icon from '@/components/Icon'
import Ticket from './Ticket'
import AceRace from './AceRace'
import type { CSSProperties } from 'react'

export type DeckName = Pick<Deck, 'id' | 'name' | 'version' | 'archetype' | 'sprites'>

/** Every event, newest first, with the overall record and how each opponent deck has gone. */
export default function TournamentList({ ts, decks: deckList, error }: { ts: Tournament[]; decks: DeckName[]; error?: string }) {
  const decks = new Map(deckList.map((d) => [d.id, d]))
  const all = record(ts.flatMap((t) => t.rounds))
  const played = all.w + all.l + all.t
  const best = ts.filter((t) => t.placement).sort((a, b) => a.placement! - b.placement! || (b.players ?? 0) - (a.players ?? 0))[0]

  // how each opponent deck has gone across every event, byes left out
  const byOpp = new Map<string, { w: number; l: number; t: number }>()
  for (const r of ts.flatMap((t) => t.rounds)) {
    const m = matchResult(r)
    if (!m || r.special === 'bye' || (r.special === 'id' && !r.opp)) continue
    const k = r.opp ?? ''
    const x = byOpp.get(k) ?? { w: 0, l: 0, t: 0 }
    x[m.toLowerCase() as 'w' | 'l' | 't']++
    byOpp.set(k, x)
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const season = seasonCP(ts, seasonOf(today))
  const matchups = [...byOpp.entries()].sort((a, b) => (b[1].w + b[1].l + b[1].t) - (a[1].w + a[1].l + a[1].t))

  return (
    <>
      <div className="page-head">
        <h1>Tournaments</h1>
        <div className="page-actions">
          <Link href="/tournaments/new?import" className="button secondary paste-game lx-entry" title="Fill a tournament in from your Limitless player page">
            <Icon name="link" /> Import from Limitless</Link>
          <Link href="/tournaments/new" className="button paste-game"><Icon name="plus" /> Log tournament</Link>
        </div>
      </div>
      {error && <p className="error">Couldn&apos;t load tournaments: {error}</p>}

      {!ts.length ? (
        <p className="panel">No tournaments yet. After your next Locals, Cup or Regionals, press <strong>Log tournament</strong> to
          record your list, each round&apos;s opponent and games, and where you finished. Played a Regionals or bigger?
          {' '}<Link href="/tournaments/new?import">Import it from Limitless</Link> instead.</p>
      ) : (
        <>
          <AceRace s={season} />
          <div className="tiles">
            <div className="panel stat"><div className="stat-label">Events</div><div className="stat-n">{ts.length}</div>
              <div className="stat-sub">{played} rounds</div></div>
            <div className={`panel stat${played ? (all.w / played >= 0.55 ? ' good' : all.w / played < 0.45 ? ' bad' : '') : ''}`}>
              <div className="stat-label">Match record</div><div className="stat-n">{recordText(all)}</div>
              {played > 0 && <div className="stat-bar" aria-hidden><span style={{ width: `${Math.round((100 * all.w) / played)}%` }} /></div>}
              <div className="stat-sub">{pct(all.w, played)} matches won</div></div>
            <div className="panel stat"><div className="stat-label">Best finish</div><div className="stat-n">{best ? ordinal(best.placement!) : '–'}</div>
              <div className="stat-sub">{best ? `${best.name}${best.players ? ` · ${best.players} players` : ''}` : 'No finishes yet'}</div></div>
          </div>

          <ul className="t-tickets">
            {ts.map((t, n) => {
              const d = t.deck_id ? decks.get(t.deck_id) : undefined
              return (
                <li key={t.id}>
                  <Link href={`/tournaments/${t.id}`} className="t-ticket-link" aria-label={`${t.name}, ${dateRange(t.start_date, t.end_date)}`}>
                    <Ticket kind={t.kind} eyebrow={t.format ? <><span aria-hidden>·</span> {t.format}</> : undefined} name={t.name}
                      meta={[dateRange(t.start_date, t.end_date), t.location,
                        d ? <>{d.name}{d.version && <span className="ver"> {d.version}</span>}</> : t.my_archetype ? prettyArch(t.my_archetype) : '']}
                      rounds={t.rounds} rec={record(t.rounds)} placement={t.placement} players={t.players} cp={t.cp}
                      arch={d?.archetype ?? t.my_archetype} slugs={d ? spritesOf(d) : undefined}
                      badge={t.rounds.some((r) => r.day === 2) ? <span className="lx-badge">Day 2</span> : undefined}
                      style={{ '--t': Math.min(n, 8) } as CSSProperties} />
                  </Link>
                </li>
              )
            })}
          </ul>

          {matchups.length > 0 && (
            <>
              <h2>Matchups at tournaments</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Opponent deck</th><th>Matches</th><th>Record</th><th>Won</th></tr></thead>
                  <tbody>
                    {matchups.map(([opp, x]) => (
                      <tr key={opp}>
                        <td><span className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'center' }}><Sprites arch={opp || null} />{prettyArch(opp || null)}</span></td>
                        <td>{x.w + x.l + x.t}</td><td>{recordText(x)}</td><td>{pct(x.w, x.w + x.l + x.t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
