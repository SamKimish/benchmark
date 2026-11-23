import { describe, expect, it } from 'vitest'
import { parseDecklist, resolvePrintings, type Card } from '../src/lib/decklist'
import { rotatedCards } from '../src/lib/legality'
import cardData from '../public/cards.json'

const CARDS = cardData as Card[]
const names = (list: string) => rotatedCards(resolvePrintings(parseDecklist(list), CARDS), CARDS).map((e) => e.name)

describe('rotatedCards', () => {
  it('flags G-mark printings with no legal reprint', () => {
    expect(names('Trainer: 3\n2 Iono PAL 185\n1 Nest Ball SVI 181')).toEqual(['Iono', 'Nest Ball'])
  })
  it('keeps old printings of cards reprinted with a legal mark', () => {
    expect(names('Trainer: 4\n4 Ultra Ball SVI 196')).toEqual([])
  })
  it('keeps legal cards, basic energy and cards it does not know', () => {
    expect(names('Pokémon: 4\n4 Dreepy TWM 128\nEnergy: 3\n3 Basic {P} Energy SVE 5\n1 Mystery Card XYZ 1')).toEqual([])
  })
  it('flags rotated cards in a list without set codes', () => {
    expect(names('2 Iono\n4 Ultra Ball')).toEqual(['Iono'])
  })
  it('reads TCG Live promo codes', () => {
    expect(names('1 Sprigatito PR-SV 1')).toEqual(['Sprigatito'])
  })
})
