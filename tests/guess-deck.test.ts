import { describe, expect, it } from 'vitest'
import { guessDeck } from '@/lib/guess-deck'
import { showedCard } from '@/lib/parser/stats'
import type { Deck } from '@/lib/types'

const deck = (id: string, line: string, order: number, archetype: string, active: boolean): Deck => ({
  id, line_id: line, name: id, version: `v${order}`, version_order: order, archetype, decklist: '', basics: null, active, sprites: [], created_at: '',
})

// Sam's Dragapult decks on 2026-11-12: an old Straight Pult line, a leftover active "Straight Dragapult"
// that carries the hammer label, and today's Hammer Pult v5 (with Dudunsparce)
const decks = [
  deck('straight-v2', 'pult', 2, 'dragapult', false),
  deck('hammer-v4', 'pult', 4, 'dragapult,crushing-hammer', false),
  deck('hammer-v5', 'pult', 5, 'dragapult,dudunsparce,crushing-hammer', true),
  deck('leftover-v3', 'leftover', 3, 'dragapult,crushing-hammer', true),
  deck('gardy', 'gardy', 1, 'gardevoir,jellicent', true),
]
const today = { 'hammer-v5': '2026-11-12T15:02:00Z', 'hammer-v4': '2026-11-11T12:41:00Z', 'straight-v2': '2026-10-23T18:42:00Z', 'leftover-v3': '2025-10-01T00:00:00Z', gardy: '2026-02-12T00:00:00Z' }

describe('guessDeck', () => {
  it('picks the deck played today when the log showed a hammer', () => {
    expect(guessDeck(decks, 'dragapult,crushing-hammer', today)).toBe('hammer-v5')
  })
  it('picks the deck played today when no hammer showed up', () => {
    expect(guessDeck(decks, 'dragapult', today)).toBe('hammer-v5')
  })
  it('never picks a hammer-less deck when a hammer showed', () => {
    const two = [deck('straight', 's', 1, 'dragapult', true), deck('hammer', 'h', 1, 'dragapult,crushing-hammer', true)]
    const at = { straight: '2026-11-12T15:00:00Z', hammer: '2026-09-01T00:00:00Z' }
    expect(guessDeck(two, 'dragapult,crushing-hammer', at)).toBe('hammer')
    expect(guessDeck(two, 'dragapult', at)).toBe('straight')
  })
  it('matches the main Pokémon, not the whole deck', () => {
    expect(guessDeck(decks, 'gardevoir', today)).toBe('gardy')
  })
  it('falls back to the deck played last', () => {
    expect(guessDeck(decks, 'charizard', today)).toBe('hammer-v5')
    expect(guessDeck(decks, null, today)).toBe('hammer-v5')
  })
})

describe('showedCard', () => {
  const names = ['Kimish17', 'Rival99']
  it('sees a hammer in the opening hand', () => {
    const log = 'Kimish17 drew 7 cards for the opening hand.\n- 7 drawn cards.\n   • Dreepy, Crushing Hammer, Ultra Ball'
    expect(showedCard(log, 'Kimish17', names, 'Crushing Hammer')).toBe(true)
    expect(showedCard(log, 'Rival99', names, 'Crushing Hammer')).toBe(false)
  })
  it('sees drawn, searched and played hammers', () => {
    expect(showedCard('Kimish17 drew Crushing Hammer.', 'Kimish17', names, 'Crushing Hammer')).toBe(true)
    expect(showedCard("- Kimish17 drew Crushing Hammer.", 'Kimish17', names, 'Crushing Hammer')).toBe(true)
    expect(showedCard("Crushing Hammer was added to Kimish17's hand.", 'Kimish17', names, 'Crushing Hammer')).toBe(true)
    expect(showedCard('Rival99 played Crushing Hammer.', 'Kimish17', names, 'Crushing Hammer')).toBe(false)
  })
  it('gives a revealed list to the player it belongs to', () => {
    const log = "Rival99's Mega Excadrill ex used Undermine.\n- Rival99 moved Kimish17's 2 cards to the discard pile.\n   • Dusclops, Crushing Hammer"
    expect(showedCard(log, 'Kimish17', names, 'Crushing Hammer')).toBe(true)
    expect(showedCard(log, 'Rival99', names, 'Crushing Hammer')).toBe(false)
  })
})
