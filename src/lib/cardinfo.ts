/** What the game page needs to draw a card it only knows by name: its picture and what kind of card it is. */
import data from '../../public/cards.json'
import { cardImage, parseDecklist, type Card } from './decklist'

export interface CardInfo { img: string | null; t: Card['t']; st: string }

const CARDS = data as Card[]
let byName: Map<string, Card> | null = null
const num = (no: string) => parseInt(no, 10)
/** One printing per card name: the regular (lowest numbered) one from its newest set. The card data
 * lists sets oldest first; the 30th-anniversary set has no pictures on Limitless. */
function index() {
  if (byName) return byName
  byName = new Map()
  for (const c of CARDS) {
    if (c.s === '30C' || !cardImage(c.s, c.no)) continue
    const had = byName.get(c.n)
    if (!had || had.s !== c.s || num(c.no) < num(had.no)) byName.set(c.n, c)
  }
  return byName
}

/** Pictures and kinds for the named cards, using the printings in `decklist` where it has them. */
export function cardInfo(names: Iterable<string>, decklist?: string | null): Record<string, CardInfo> {
  const idx = index()
  const mine = new Map(parseDecklist(decklist ?? '').filter((e) => e.set && e.no).map((e) => [e.name, e]))
  const out: Record<string, CardInfo> = {}
  for (const n of new Set(names)) {
    const c = idx.get(n)
    const e = mine.get(n)
    if (!c && !e) continue
    out[n] = { img: e ? cardImage(e.set, e.no) : c ? cardImage(c.s, c.no) : null, t: c?.t ?? e?.t ?? 'T', st: c?.st ?? '' }
  }
  return out
}
