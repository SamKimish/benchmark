import Link from 'next/link'
import { cardImage, displayPrinting, parseDecklist, resolvePrintings, total, type Card } from '@/lib/decklist'
import cardData from '../../../public/cards.json'

const CARDS = cardData as Card[]
import { archetypeName, spritesOf } from '@/lib/archetypes'
import { pct, prettyArch } from '@/lib/format'
import type { Tally } from '@/lib/deckstats'
import Sprites from '@/components/Sprites'
import type { Deck } from '@/lib/types'
import DeleteDeck from './DeleteDeck'

/** One tile per deck: its newest version, and how many versions it has had. */
function latestVersions(decks: Deck[]) {
  const lines = new Map<string, { deck: Deck; versions: number }>()
  for (const d of decks) {
    const l = lines.get(d.line_id)
    if (!l) lines.set(d.line_id, { deck: d, versions: 1 })
    else lines.set(d.line_id, { deck: d.version_order > l.deck.version_order ? d : l.deck, versions: l.versions + 1 })
  }
  return [...lines.values()]
}

export default function DeckGallery({ decks, records = {} }: { decks: Deck[]; records?: Record<string, Tally> }) {
  return (
    <>
      <div className="deck-gallery">
        <Link href="/decks/new" className="deck-tile new">
          <div className="mosaic empty">+</div>
          <div><strong>New deck</strong><div className="muted small">Build or import a list</div></div>
        </Link>
        {latestVersions(decks).map(({ deck: d, versions }) => {
          const es = resolvePrintings(parseDecklist(d.decklist), CARDS)
          const rec = records[d.line_id]
          const rate = rec && rec.wins + rec.losses ? rec.wins / (rec.wins + rec.losses) : null
          return (
            <div key={d.id} className="deck-tile">
              <Link href={`/decks/${d.id}`} className="mosaic">
                {es.slice(0, 24).map((e, i) => {
                  const shown = displayPrinting(e, CARDS)
                  const src = cardImage(shown.set, shown.no, 'XS')
                  return src ? <img key={i} src={src} alt={e.name} loading="lazy" /> : <span key={i} className="noimg">{e.name}</span>
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
                      <strong className={rate === null ? '' : rate >= 0.55 ? 'good' : rate < 0.45 ? 'bad' : ''}>{pct(rec.wins, rec.wins + rec.losses)}</strong>
                    </> : <span className="muted">No matches yet</span>}
                  </div>
                  </span>
                </Link>
                <DeleteDeck lineId={d.line_id} name={d.name} versions={versions} />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
