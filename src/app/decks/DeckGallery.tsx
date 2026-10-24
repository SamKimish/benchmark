import Link from 'next/link'
import { cardImage, parseDecklist, resolvePrintings, total, type Card } from '@/lib/decklist'
import cardData from '../../../public/cards.json'

const CARDS = cardData as Card[]
import { archetypeName } from '@/lib/archetypes'
import { prettyArch } from '@/lib/format'
import type { Deck } from '@/lib/types'
import DeleteDeck from './DeleteDeck'

export default function DeckGallery({ decks }: { decks: Deck[] }) {
  return (
    <>
      <div className="deck-gallery">
        <Link href="/decks/new" className="deck-tile new">
          <div className="mosaic empty">+</div>
          <div><strong>New deck</strong><div className="muted small">Build or import a list</div></div>
        </Link>
        {decks.map((d) => {
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
                  <strong>{d.name}{d.version ? ` ${d.version}` : ''}</strong>
                  <div className="muted small">{archetypeName(d.archetype) ?? prettyArch(d.archetype)} · {total(es)} cards{d.active ? '' : ' · retired'}</div>
                </Link>
                <DeleteDeck id={d.id} name={d.name} />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
