import Link from 'next/link'
import Icon from '@/components/Icon'
import { requireUser } from '@/lib/supabase/server'
import { dayKey, dayLabel, deckLabel, pct, prettyArch, timeOnly } from '@/lib/format'
import Sprites from '@/components/Sprites'
import type { Deck } from '@/lib/types'

interface Row {
  id: string
  played_at: string
  deck_id: string | null
  result: 'W' | 'L' | null
  went_first: boolean | null
  opp_archetype: string | null
  opponent: string | null
  tags: string[]
  end_reason: string | null
  prizes_taken: number
  prizes_given: number
}

const PAGE = 1000

export default async function MatchLog({ searchParams }: { searchParams: Promise<{ deck?: string; v?: string }> }) {
  const q = await searchParams
  const { supabase } = await requireUser()
  const { data: deckData } = await supabase.from('decks').select('*').order('name').order('version_order')
  const decks = (deckData ?? []) as Deck[]
  const deckById = new Map(decks.map((d) => [d.id, d]))
  const names = [...new Set(decks.map((d) => d.name))]
  const versions = decks.filter((d) => d.name === q.deck)

  const ids = q.v ? [q.v] : q.deck ? versions.map((d) => d.id) : null
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from('games')
      .select('id, played_at, deck_id, result, went_first, opp_archetype, opponent, tags, end_reason, prizes_taken:stats->prizes_taken, prizes_given:stats->prizes_given')
      .order('played_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (ids) query = query.in('deck_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data as unknown as Row[]))
    if (data.length < PAGE) break
  }

  const done = rows.filter((r) => r.result)
  const wins = (xs: Row[]) => xs.filter((r) => r.result === 'W').length
  const first = done.filter((r) => r.went_first === true)
  const second = done.filter((r) => r.went_first === false)

  const byOpp = new Map<string, Row[]>()
  for (const r of done) byOpp.set(r.opp_archetype ?? '', [...(byOpp.get(r.opp_archetype ?? '') ?? []), r])
  const matchups = [...byOpp.entries()].sort((a, b) => b[1].length - a[1].length)
  const tagCounts = new Map<string, number>()
  for (const r of done) if (r.result === 'L') for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  const losses = done.length - wins(done)

  const myArch = (r: Row) => (r.deck_id ? deckById.get(r.deck_id)?.archetype : null) ?? null
  const days: [string, Row[]][] = []
  for (const r of rows) {
    const d = dayKey(r.played_at)
    if (days.at(-1)?.[0] === d) days.at(-1)![1].push(r)
    else days.push([d, [r]])
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Match log</h1>
        <form className="row" method="get">
          <label>Deck
            <select name="deck" defaultValue={q.deck ?? ''}>
              <option value="">All decks</option>
              {names.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          {q.deck && versions.length > 1 && (
            <label>Version
              <select name="v" defaultValue={q.v ?? ''}>
                <option value="">All versions</option>
                {versions.map((d) => <option key={d.id} value={d.id}>{d.version || 'Unnamed'}</option>)}
              </select>
            </label>
          )}
          <button className="secondary">Show</button>
          <Link href="/upload" className="button"><Icon name="import" /> Upload games</Link>
        </form>
      </div>

      {!rows.length ? (
        <p className="panel">No games yet. <Link href="/upload">Upload some logs</Link> to get started.</p>
      ) : (
        <>
          <div className="tiles">
            <div className="panel tile"><div className="muted small">Games</div><div className="n">{rows.length}</div></div>
            <div className="panel tile"><div className="muted small">Win rate</div><div className="n">{pct(wins(done), done.length)}</div>
              <div className="muted small">{wins(done)}–{done.length - wins(done)}</div></div>
            <div className="panel tile"><div className="muted small">Going 1st</div><div className="n">{pct(wins(first), first.length)}</div>
              <div className="muted small">{first.length} games</div></div>
            <div className="panel tile"><div className="muted small">Going 2nd</div><div className="n">{pct(wins(second), second.length)}</div>
              <div className="muted small">{second.length} games</div></div>
          </div>

          <h2>Matches</h2>
          {days.map(([day, xs], i) => {
            const w = wins(xs), l = xs.filter((r) => r.result === 'L').length
            const decksPlayed = [...new Set(xs.map((r) => myArch(r)).filter(Boolean))].slice(0, 2)
            return (
              <details key={day} className="day" open={i === 0}>
                <summary>
                  <span className="day-date">{dayLabel(day)}</span>
                  <span className="day-decks">{decksPlayed.map((k) => <Sprites key={k} arch={k} />)}</span>
                  <span className="day-record"><strong>{w}-{l}</strong><span className="muted small">{xs.length} total</span></span>
                </summary>
                <ul className="matches">
                  {xs.map((r) => (
                    <li key={r.id}>
                      <Link href={`/games/${r.id}`} className={`match ${r.result ?? 'none'}`}>
                        <Sprites arch={myArch(r)} />
                        <span className="match-main">
                          <strong>{r.result === 'W' ? 'Win' : r.result === 'L' ? 'Loss' : 'Unknown'} vs {prettyArch(r.opp_archetype)}</strong>
                          <span className="muted small">{timeOnly(r.played_at)} · {deckLabel(r.deck_id ? deckById.get(r.deck_id) : null)} · prizes {r.prizes_taken}–{r.prizes_given}</span>
                          {r.result === 'L' && r.tags.length > 0 && <span>{r.tags.map((t) => <span key={t} className="pill">{t}</span>)}</span>}
                        </span>
                        <span className="match-order">{r.went_first === null ? '–' : r.went_first ? '1st' : '2nd'}</span>
                        <Sprites arch={r.opp_archetype} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )
          })}

          <div className="grid2">
            <div>
              <h2>Matchups</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Opponent deck</th><th>Games</th><th>Win rate</th><th>1st</th><th>2nd</th></tr></thead>
                  <tbody>
                    {matchups.map(([opp, xs]) => {
                      const f = xs.filter((r) => r.went_first === true), s = xs.filter((r) => r.went_first === false)
                      return (
                        <tr key={opp}>
                          <td><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><Sprites arch={opp} />{prettyArch(opp)}</span></td><td>{xs.length}</td><td>{pct(wins(xs), xs.length)}</td>
                          <td>{pct(wins(f), f.length)}</td><td>{pct(wins(s), s.length)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h2>What went wrong in losses</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Tag</th><th>Losses</th><th>Share</th></tr></thead>
                  <tbody>
                    {[...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                      <tr key={t}><td>{t}</td><td>{n}</td><td>{pct(n, losses)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
