import Link from 'next/link'
import type { CSSProperties } from 'react'
import { cardImage, displayPrinting, parseDecklist, resolvePrintings, total, type Card } from '@/lib/decklist'
import cardData from '../../../public/cards.json'
import { archetypeName, spritesOf } from '@/lib/archetypes'
import { pct, prettyArch } from '@/lib/format'
import type { Tally } from '@/lib/deckstats'
import Sprites from '@/components/Sprites'
import type { Deck } from '@/lib/types'
import DeleteDeck from './DeleteDeck'
import ArchiveDeck from './ArchiveDeck'

const CARDS = cardData as Card[]

type Record_ = Tally & { last?: string }
type Line = { deck: Deck; versions: number }

/** A deck not played for this long gets a quiet "idle since" note, as a hint it may have rotated. */
export const IDLE_DAYS = 45

/** One tile per deck: its newest version, and how many versions it has had. */
function latestVersions(decks: Deck[]): Line[] {
  const lines = new Map<string, Line>()
  for (const d of decks) {
    const l = lines.get(d.line_id)
    if (!l) lines.set(d.line_id, { deck: d, versions: 1 })
    else lines.set(d.line_id, { deck: d.version_order > l.deck.version_order ? d : l.deck, versions: l.versions + 1 })
  }
  return [...lines.values()]
}

/** A line is archived when any of its versions is (they're set together; this covers a version saved since). */
function archivedLines(decks: Deck[]) {
  return new Set(decks.filter((d) => d.archived_at).map((d) => d.line_id))
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
const rateClass = (r: Tally) => {
  const n = r.wins + r.losses
  if (!n) return ''
  const rate = r.wins / n
  return rate >= 0.55 ? 'good' : rate < 0.45 ? 'bad' : ''
}

function Tile({ line: { deck: d, versions }, rec, archived, now, i }: { line: Line; rec?: Record_; archived: boolean; now: number; i: number }) {
  const es = resolvePrintings(parseDecklist(d.decklist), CARDS)
  const idle = !archived && rec?.last && now - Date.parse(rec.last) > IDLE_DAYS * 864e5
  return (
    <div className={`deck-tile${archived ? ' archived' : ''}`} style={{ '--i': i } as CSSProperties}>
      <Link href={`/decks/${d.id}`} className="mosaic">
        {es.slice(0, 24).map((e, j) => {
          const shown = displayPrinting(e, CARDS)
          const src = cardImage(shown.set, shown.no, 'XS')
          return src ? <img key={j} src={src} alt={e.name} loading="lazy" /> : <span key={j} className="noimg">{e.name}</span>
        })}
        <span className="tile-sprites"><Sprites slugs={spritesOf(d)} /></span>
      </Link>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'start', flexWrap: 'nowrap' }}>
        <Link href={`/decks/${d.id}`} className="deck-tile-info">
          <span>
            <strong>{d.name}</strong> <span className="version small">{d.version}</span>
            <div className="muted small">
              {archetypeName(d.archetype) ?? prettyArch(d.archetype)} · {total(es)} cards
              {versions > 1 ? ` · ${versions} versions` : ''}
            </div>
            <div className="small deck-record">
              {rec ? <>
                <span>{rec.games} match{rec.games === 1 ? '' : 'es'}</span>
                <span>{rec.wins}–{rec.losses}</span>
                <strong className={rateClass(rec)}>{pct(rec.wins, rec.wins + rec.losses)}</strong>
              </> : <span className="muted">No matches yet</span>}
            </div>
            {archived && d.archived_at
              ? <div className="deck-when">Archived {shortDate(d.archived_at)}{rec?.last ? ` · last played ${shortDate(rec.last)}` : ''}</div>
              : idle && <div className="deck-when idle">Not played since {shortDate(rec!.last!)}</div>}
          </span>
        </Link>
        <span className="tile-tools">
          <ArchiveDeck lineId={d.line_id} name={d.name} archived={archived} />
          <DeleteDeck lineId={d.line_id} name={d.name} versions={versions} />
        </span>
      </div>
    </div>
  )
}

export default function DeckGallery({ decks, records = {}, now = Date.now() }: { decks: Deck[]; records?: Record<string, Record_>; now?: number }) {
  const lines = latestVersions(decks)
  const gone = archivedLines(decks)
  const live = lines.filter((l) => !gone.has(l.deck.line_id))
  const shelf = lines.filter((l) => gone.has(l.deck.line_id))
    // most recently archived first
    .sort((a, b) => Date.parse(maxArchived(decks, b.deck.line_id)) - Date.parse(maxArchived(decks, a.deck.line_id)))
  const sum = shelf.reduce<Tally>((t, l) => {
    const r = records[l.deck.line_id]
    return r ? { games: t.games + r.games, wins: t.wins + r.wins, losses: t.losses + r.losses } : t
  }, { games: 0, wins: 0, losses: 0 })
  return (
    <>
      <div className="deck-gallery">
        <Link href="/decks/new" className="deck-tile new">
          <div className="mosaic empty">+</div>
          <div><strong>New deck</strong><div className="muted small">Build or import a list</div></div>
        </Link>
        {live.map((l, i) => <Tile key={l.deck.id} line={l} rec={records[l.deck.line_id]} archived={false} now={now} i={i} />)}
      </div>
      {shelf.length > 0 && (
        <details className="deck-archive">
          <summary>
            <span className="chevron" aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></span>
            <span className="archive-title">
              <span className="archive-name">Archived</span>
              <span className="section-meta">{shelf.length} deck{shelf.length === 1 ? '' : 's'}<span className="archive-why"> · rotated or retired</span></span>
            </span>
            <span className="archive-stack" aria-hidden>
              {shelf.slice(0, 8).map((l) => <span key={l.deck.id} className="deck-chip"><Sprites slugs={spritesOf(l.deck)} /></span>)}
              {shelf.length > 8 && <span className="archive-more">+{shelf.length - 8}</span>}
            </span>
            {sum.games > 0 && (
              <span className={`day-record ${rateClass(sum)}`}>
                <strong>{sum.wins}–{sum.losses}</strong>
                <span className="day-n">{sum.games} matches</span>
              </span>
            )}
          </summary>
          <div className="deck-gallery archive-grid">
            {shelf.map((l, i) => <Tile key={l.deck.id} line={l} rec={records[l.deck.line_id]} archived now={now} i={i} />)}
          </div>
        </details>
      )}
    </>
  )
}

function maxArchived(decks: Deck[], lineId: string) {
  return decks.filter((d) => d.line_id === lineId && d.archived_at).map((d) => d.archived_at!).sort().at(-1) ?? ''
}
