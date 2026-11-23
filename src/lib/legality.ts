/** Standard legality: which cards in a list have rotated out (see scripts/build-cards.mjs for the regulation marks). */
import { cardKey, type Card, type Entry } from './decklist'
import rotatedData from './rotated.json'

const ROTATED = rotatedData as Record<string, string>
const ROTATED_NAMES = new Set(Object.values(ROTATED))
const legalNames = new WeakMap<Card[], Set<string>>()

/**
 * The entries no longer legal in Standard: a printing with a rotated regulation mark and no legal reprint, or
 * (for a list written without set codes) a card whose every known printing has rotated. Cards the data doesn't
 * know at all are left alone rather than guessed at.
 */
export function rotatedCards(entries: Entry[], cards: Card[]): Entry[] {
  let legal = legalNames.get(cards)
  if (!legal) legalNames.set(cards, (legal = new Set(cards.map((c) => c.n))))
  return entries.filter((e) => e.set
    ? cardKey(e.set, e.no) in ROTATED
    : ROTATED_NAMES.has(e.name) && !legal.has(e.name))
}
