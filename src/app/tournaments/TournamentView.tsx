import Link from 'next/link'
import { prettyArch } from '@/lib/format'
import {
  dateRange, finishText, kindLabel, matchPoints, matchResult, record, recordText, type Tournament,
} from '@/lib/tournaments'
import type { Deck } from '@/lib/types'
import Sprites from '@/components/Sprites'
import { spritesOf } from '@/lib/archetypes'
import Icon from '@/components/Icon'
import { KindIcon } from './KindIcon'
import DeleteTournament from './DeleteTournament'

/** One tournament, laid out like the standings sheet: the event, your record and deck, then every round. */
export default function TournamentView({ t, deck: d }: { t: Tournament; deck: Deck | null }) {
  const myArch = d?.archetype ?? t.my_archetype
  const rec = record(t.rounds)
  const finish = finishText(t.placement, t.players)

  return (
    <>
      <Link href="/tournaments" className="button secondary back-link"><Icon name="back" /> Tournaments</Link>
      <article className="t-sheet">
        <div className="t-tools">
          <Link href={`/tournaments/${t.id}/edit`} className="icon-btn" title="Edit this tournament" aria-label="Edit this tournament"><Icon name="edit" size={20} /></Link>
          <DeleteTournament id={t.id} name={t.name} />
        </div>
        <header className="t-head">
          <div className="t-title">
            <h1>{t.name}</h1>
            <div className="t-dates">{dateRange(t.start_date, t.end_date)}{t.location && <> · {t.location}</>}</div>
            <div className="t-pills">
              <span className={`t-pill kind-${t.kind}`}><KindIcon kind={t.kind} /> {kindLabel(t.kind)}</span>
              {t.format && <span className="t-pill">{t.format}</span>}
              {finish && <span className="t-pill finish">{finish}</span>}
            </div>
          </div>
          <div className="t-score">
            <div className="t-record" title="Wins-losses-ties">{recordText(rec)}</div>
            <Sprites arch={myArch} slugs={d ? spritesOf(d) : undefined} />
            <div className="muted small">
              {d ? <Link href={`/decks/${d.id}`}>{d.name}{d.version && <span className="ver"> {d.version}</span>}</Link> : prettyArch(myArch)}
            </div>
          </div>
        </header>

        {t.rounds.length ? (
          <table className="t-rounds-table">
            <thead><tr><th>Round</th><th>Deck</th><th className="t-opp-col">Opponent</th><th className="t-res-col">Result</th></tr></thead>
            <tbody>
              {t.rounds.map((r, i) => {
                const m = matchResult(r)
                return (
                  <tr key={i} className={`t-round ${m ?? 'none'}`}>
                    <td className="t-rn">{i + 1}</td>
                    <td>{r.special === 'bye' ? <span className="muted">Bye</span> : <span className="t-opp-deck"><Sprites arch={r.opp} /><span className="t-opp-name">{r.opp ? prettyArch(r.opp) : 'Unknown deck'}</span></span>}</td>
                    <td className="t-opp-col wrap">{r.opponent}{r.notes && <div className="muted small">{r.notes}</div>}</td>
                    <td className="t-games">{r.special === 'id' ? 'ID' : r.special === 'bye' ? 'BYE' : r.games || '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="panel">No rounds yet. <Link href={`/tournaments/${t.id}/edit`}>Add them</Link>.</p>
        )}
        <p className="muted small t-points">{matchPoints(rec)} match points · {t.rounds.length} {t.rounds.length === 1 ? 'round' : 'rounds'}</p>
      </article>

      {t.notes && (
        <section>
          <h2>Notes</h2>
          <p className="panel t-notes-view">{t.notes}</p>
        </section>
      )}
    </>
  )
}
