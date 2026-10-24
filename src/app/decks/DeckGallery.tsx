import Link from 'next/link'
import { cardImage, parseDecklist, resolvePrintings, total, type Card } from '@/lib/decklist'
import cardData from '../../../public/cards.json'

const CARDS = cardData as Card[]
import { archetypeName } from '@/lib/archetypes'
import { prettyArch } from '@/lib/format'
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

export default function DeckGallery({ decks }: { decks: Deck[] }) {
  return (
    <>
      <div className="deck-gallery">
        <Link href="/decks/new" className="deck-tile new">
          <div className="mosaic empty">+</div>
          <div><strong>New deck</strong><div className="muted small">Build or import a list</div></div>
        </Link>
        {latestVersions(decks).map(({ deck: d, versions }) => {
          const es = resolvePrintings(parseDecklist(d.decklist), CARDS)
          return (
            <div key={d.id} className="deck-tile">
              <Link href={`/decks/${d.id}`} className="mosaic">
                {es.slice(0, 24).map((e, i) => {
                  const src = cardImage(e.set, e.no, 'XS')
                  return src ? <img key={i} src={src} alt={e.name} loading="lazy" /> : <span key={i} className="noimg">{e.name}</span>
                })}
              </Link>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'start' }}>
                <Link href={`/decks/${d.id}`} style={{ textDecoration: 'none' }}>
                  <strong>{d.name}</strong> <span className="version small">{d.version}</span>
                  <div className="muted small">
                    {archetypeName(d.archetype) ?? prettyArch(d.archetype)} · {total(es)} cards
                    {versions > 1 ? ` · ${versions} versions` : ''}
                  </div>
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
