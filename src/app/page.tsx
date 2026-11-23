import Link from 'next/link'
import Icon from '@/components/Icon'
import { requireUser } from '@/lib/supabase/server'
import { dayKey, dayParts, pct, prettyArch, timeOnly } from '@/lib/format'
import Sprites from '@/components/Sprites'
import QuickPaste from '@/components/QuickPaste'
import { MatchEditor, RowActions } from '@/components/MatchEditor'
import Reanalyse from '@/components/Reanalyse'
import Stat from '@/components/Stat'
import { knownTagsFrom } from '@/lib/tags'
import { gameSprites } from '@/lib/archetypes'
import { PARSER_VERSION } from '@/lib/games'
import type { Deck } from '@/lib/types'

interface Row {
  id: string
  played_at: string
  deck_id: string | null
  my_sprites: string[]
  my_archetype: string | null
  result: 'W' | 'L' | null
  went_first: boolean | null
  opp_archetype: string | null
  opponent: string | null
  tags: string[]
  win_tags: string[]
  end_reason: string | null
  prizes_taken: number
  prizes_given: number
}

const PAGE = 1000

/** ' good' / ' bad' for a win rate worth colouring, the same thresholds as the stat tiles. */
const tone = (w: number, n: number) => (!n ? '' : w / n >= 0.55 ? ' good' : w / n < 0.45 ? ' bad' : '')

/** A share of games as a number with a slim bar behind it. */
function Share({ n, of, kind }: { n: number; of: number; kind: 'good' | 'bad' }) {
  return (
    <span className={`share ${kind}`}>
      <span className="share-bar" aria-hidden><span style={{ width: `${of ? Math.round((100 * n) / of) : 0}%` }} /></span>
      <span className="share-n">{pct(n, of)}</span>
    </span>
  )
}

export default async function MatchLog({ searchParams }: { searchParams: Promise<{ deck?: string; v?: string }> }) {
  const q = await searchParams
  const { supabase } = await requireUser()
  const { data: deckData } = await supabase.from('decks').select('*').order('name').order('version_order')
  const decks = (deckData ?? []) as Deck[]
  const deckById = new Map(decks.map((d) => [d.id, d]))
  // decks listed by when they were last played, newest first; never-played decks last
  const lastPlayed = new Map<string, string>()
  const deckLastPlayed: Record<string, string> = {}
  await Promise.all(decks.map(async (d) => {
    const { data } = await supabase.from('games').select('played_at').eq('deck_id', d.id).order('played_at', { ascending: false }).limit(1)
    const at = data?.[0]?.played_at as string | undefined
    if (at) deckLastPlayed[d.id] = at
    if (at && at > (lastPlayed.get(d.name) ?? '')) lastPlayed.set(d.name, at)
  }))
  const names = [...new Set(decks.map((d) => d.name))]
    .sort((a, b) => (lastPlayed.get(b) ?? '').localeCompare(lastPlayed.get(a) ?? '') || a.localeCompare(b))
  const versions = decks.filter((d) => d.name === q.deck)

  const ids = q.v ? [q.v] : q.deck ? versions.map((d) => d.id) : null
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from('games')
      .select('id, played_at, deck_id, my_sprites, my_archetype, result, went_first, opp_archetype, opponent, tags, win_tags, end_reason, prizes_taken:stats->prizes_taken, prizes_given:stats->prizes_given')
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
  const winCounts = new Map<string, number>()
  for (const r of done) if (r.result === 'W') for (const t of r.win_tags) winCounts.set(t, (winCounts.get(t) ?? 0) + 1)

  // reasons for the edit pop-up, most used first
  const knownTags = knownTagsFrom(rows)
  const { count: outdated } = await supabase.from('games').select('id', { count: 'exact', head: true }).lt('parser_version', PARSER_VERSION)
  const deck = (r: Row) => (r.deck_id ? deckById.get(r.deck_id) : undefined)
  const mySprites = (r: Row) => gameSprites(r, deck(r))
  const days: [string, Row[]][] = []
  for (const r of rows) {
    const d = dayKey(r.played_at)
    if (days.at(-1)?.[0] === d) days.at(-1)![1].push(r)
    else days.push([d, [r]])
  }

  return (
    <>
      <div className="page-head">
        <h1>Match log</h1>
        <div className="page-actions">
          <QuickPaste decks={decks} lastPlayed={deckLastPlayed} knownTags={knownTags} />
          <Link href="/upload" className="button secondary"><Icon name="import" /> Upload files</Link>
        </div>
      </div>
      <form className="row filters" method="get">
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
      </form>

      {!rows.length ? (
        <p className="panel">No games yet. Copy a game log in TCG Live and press <strong>Paste game</strong>, or <Link href="/upload">upload log files</Link>.</p>
      ) : (
        <>
          <div className="tiles">
            <Stat label="Games" value={String(rows.length)} sub={`${wins(done)} W · ${done.length - wins(done)} L`} />
            <Stat label="Win rate" w={wins(done)} n={done.length} />
            <Stat label="Going 1st" w={wins(first)} n={first.length} />
            <Stat label="Going 2nd" w={wins(second)} n={second.length} />
          </div>

          <h2 className="section-head">Matches <span className="section-meta">{days.length} {days.length === 1 ? 'day' : 'days'}</span></h2>
          <Reanalyse outdated={outdated ?? 0} />
          <MatchEditor decks={decks} knownTags={knownTags}>
          {days.map(([day, xs], i) => {
            const w = wins(xs), l = xs.filter((r) => r.result === 'L').length
            const decksPlayed = [...new Map(xs.map((r) => mySprites(r)).filter((x) => x.length).map((x) => [x.join(','), x])).values()].slice(0, 2)
            const { weekday, date } = dayParts(day)
            return (
              <details key={day} className="day" open={i === 0}>
                <summary>
                  <span className="day-date"><span className="day-wd">{weekday}</span><span className="day-dm">{date}</span></span>
                  <span className="day-decks">{decksPlayed.map((k) => <span key={k.join(',')} className="deck-chip"><Sprites slugs={k} /></span>)}</span>
                  <span className={`day-record${tone(w, w + l)}`}><strong>{w}–{l}</strong><span className="day-n">{xs.length} {xs.length === 1 ? 'game' : 'games'}</span></span>
                  <span className="chevron" aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></span>
                </summary>
                <ul className="matches">
                  {xs.map((r) => (
                    <li key={r.id} className="match-row">
                      <Link href={`/games/${r.id}`} className={`match ${r.result ?? 'none'}`}>
                        <Sprites slugs={mySprites(r)} />
                        <span className="match-main">
                          <strong>{r.result === 'W' ? 'Win' : r.result === 'L' ? 'Loss' : 'Unknown'} vs {prettyArch(r.opp_archetype)}</strong>
                          <span className="match-meta">
                            <span className="muted">{timeOnly(r.played_at)}</span>
                            {deck(r) ? <span className="deck-name">{deck(r)!.name}{deck(r)!.version && <span className="ver">{deck(r)!.version}</span>}</span> : <span className="muted">No deck</span>}
                            <span className="muted">prizes {r.prizes_taken}–{r.prizes_given}</span>
                          </span>
                        </span>
                        <span className="match-tags">
                          {r.win_tags.map((t) => <span key={`w-${t}`} className="pill good">{t}</span>)}
                          {r.tags.map((t) => <span key={`l-${t}`} className="pill bad">{t}</span>)}
                        </span>
                        <span className="match-order">{r.went_first === null ? '–' : r.went_first ? '1st' : '2nd'}</span>
                        <Sprites arch={r.opp_archetype} />
                      </Link>
                      <RowActions row={r} />
                    </li>
                  ))}
                </ul>
              </details>
            )
          })}
          </MatchEditor>

          <div className="grid2">
            <div>
              <h2 className="section-head">Matchups <span className="section-meta">{matchups.length} decks faced</span></h2>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Opponent deck</th><th className="num">Games</th><th className="num">Win rate</th><th className="num">1st</th><th className="num">2nd</th></tr></thead>
                  <tbody>
                    {matchups.map(([opp, xs]) => {
                      const f = xs.filter((r) => r.went_first === true), s = xs.filter((r) => r.went_first === false)
                      return (
                        <tr key={opp}>
                          <td><span className="opp-cell"><Sprites arch={opp} /><span>{prettyArch(opp)}</span></span></td>
                          <td className="num">{xs.length}</td>
                          <td className={`num rate${tone(wins(xs), xs.length)}`}><strong>{pct(wins(xs), xs.length)}</strong></td>
                          <td className="num muted">{pct(wins(f), f.length)}</td><td className="num muted">{pct(wins(s), s.length)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h2 className="section-head">What went wrong in losses</h2>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Reason</th><th className="num">Losses</th><th className="share-col">Share</th></tr></thead>
                  <tbody>
                    {[...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                      <tr key={t}><td><span className="pill bad">{t}</span></td><td className="num">{n}</td><td><Share n={n} of={losses} kind="bad" /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2 className="section-head">What went right in wins</h2>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Reason</th><th className="num">Wins</th><th className="share-col">Share</th></tr></thead>
                  <tbody>
                    {[...winCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                      <tr key={t}><td><span className="pill good">{t}</span></td><td className="num">{n}</td><td><Share n={n} of={wins(done)} kind="good" /></td></tr>
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
