import Link from 'next/link'
import Stat from '@/components/Stat'
import Sprites from '@/components/Sprites'
import { pct, prettyArch, shortDate } from '@/lib/format'
import { deckStats, type DeckGame } from '@/lib/deckstats'
import type { Deck } from '@/lib/types'

/** A deck's record across all its versions: headline tiles, each version's record, and its most played matchups. */
export default function DeckStats({ deck, versions, games }: { deck: Deck; versions: Deck[]; games: DeckGame[] }) {
  if (!games.length) return <p className="panel deck-stats-empty muted">No matches with this deck yet. Games you add with it will show its record here.</p>
  const s = deckStats(games)
  const done = (t: { wins: number; losses: number }) => t.wins + t.losses
  const played = versions.filter((v) => s.byDeck.has(v.id)).sort((a, b) => b.version_order - a.version_order)
  return (
    <section className="deck-stats">
      <div className="tiles">
        <Stat label="Matches" value={String(s.all.games)} sub={`${s.all.wins} W · ${s.all.losses} L${s.lastPlayed ? ` · last ${shortDate(s.lastPlayed)}` : ''}`} />
        <Stat label="Win rate" w={s.all.wins} n={done(s.all)} />
        <Stat label="Going 1st" w={s.first.wins} n={done(s.first)} />
        <Stat label="Going 2nd" w={s.second.wins} n={done(s.second)} />
      </div>
      <div className="deck-stats-tables">
        {played.length > 1 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Version</th><th>Matches</th><th>Record</th><th>Win rate</th></tr></thead>
              <tbody>
                {played.map((v) => {
                  const t = s.byDeck.get(v.id)!
                  return (
                    <tr key={v.id} className={v.id === deck.id ? 'current' : undefined}>
                      <td><Link href={`/decks/${v.id}`}>{v.version || 'Unnamed'}</Link></td><td>{t.games}</td><td>{t.wins}–{t.losses}</td><td>{pct(t.wins, done(t))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Most played against</th><th>Matches</th><th>Record</th><th>Win rate</th></tr></thead>
            <tbody>
              {s.matchups.slice(0, 5).map((m) => (
                <tr key={m.opp ?? ''}>
                  <td><span className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'center' }}><Sprites arch={m.opp} />{prettyArch(m.opp)}</span></td>
                  <td>{m.games}</td><td>{m.wins}–{m.losses}</td><td>{pct(m.wins, done(m))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small"><Link href={`/?deck=${encodeURIComponent(deck.name)}`}>See every match with {deck.name} →</Link></p>
    </section>
  )
}
