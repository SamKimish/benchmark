import { describe, expect, it } from 'vitest'
import {
  buildImport, closestDeck, countryName, deckKey, decklistText, listDistance, parseLabsDate, parseLabsUrl,
  type LabsDecklist, type LabsMatch, type LabsPlayer, type LabsTournament,
} from '../src/lib/limitless'
import { matchResult, record, recordText } from '../src/lib/tournaments'
import tournament from './fixtures/limitless/tournament.json'
import player from './fixtures/limitless/player.json'
import matches from './fixtures/limitless/matches.json'
import decklist from './fixtures/limitless/decklist.json'

const gdansk = () => buildImport(
  { tournamentId: '0079', playerId: '1664', division: 'MA' },
  tournament.message as LabsTournament, player.message as LabsPlayer, matches.message as LabsMatch[], decklist.message as LabsDecklist,
)

describe('Limitless links', () => {
  it('reads a Labs player link in its usual shapes', () => {
    const want = { tournamentId: '0079', playerId: '1664', division: 'MA' }
    expect(parseLabsUrl('https://labs.limitlesstcg.com/0079/player/1664')).toEqual(want)
    expect(parseLabsUrl('labs.limitlesstcg.com/0079/player/1664/decklist')).toEqual(want)
    expect(parseLabsUrl('  https://labs.limitlesstcg.com/0079/player/1664?tab=1#x ')).toEqual(want)
    expect(parseLabsUrl('https://labs.limitlesstcg.com/0079/SR/player/12')).toEqual({ tournamentId: '0079', playerId: '12', division: 'SR' })
  })
  it('turns down anything else', () => {
    expect(parseLabsUrl('')).toBeNull()
    expect(parseLabsUrl('https://labs.limitlesstcg.com/0079/standings')).toBeNull()
    expect(parseLabsUrl('https://evil.example.com/0079/player/1664')).toBeNull()
    expect(parseLabsUrl('https://limitlesstcg.com.evil.io/0079/player/1664')).toBeNull()
    expect(parseLabsUrl('not a link')).toBeNull()
  })
})

describe('Labs dates', () => {
  it('reads one day, a weekend, and a weekend across months and years', () => {
    expect(parseLabsDate('March 1, 2026')).toEqual({ start: '2026-03-01', end: null })
    expect(parseLabsDate('November 8–9, 2026')).toEqual({ start: '2026-11-08', end: '2026-11-09' })
    expect(parseLabsDate('October 31–November 1, 2026')).toEqual({ start: '2026-10-31', end: '2026-11-01' })
    expect(parseLabsDate('December 31–January 1, 2027')).toEqual({ start: '2026-12-31', end: '2027-01-01' })
    expect(parseLabsDate('soon')).toBeNull()
  })
})

describe('importing a run', () => {
  it('fills in the Gdańsk event the way the Labs page shows it', () => {
    const t = gdansk()
    expect(t).toMatchObject({
      name: 'Gdańsk Regionals', kind: 'regionals', format: 'Standard', location: 'Gdańsk, Poland',
      start_date: '2026-10-31', end_date: '2026-11-01', placement: 323, players: 1739,
      my_archetype: 'dragapult', player: 'Sam Kimish', day2: true,
      source: 'https://labs.limitlesstcg.com/0079/player/1664',
    })
    expect(t.rounds).toHaveLength(13)
  })

  it('gets each round in order with the opponent, their deck and the result', () => {
    const t = gdansk()
    expect(t.rounds.map((r) => matchResult(r)).join('')).toBe('TWWWWLLWLLLLL')
    expect(recordText(record(t.rounds))).toBe('5-7-1')
    expect(t.rounds[0]).toMatchObject({ opponent: 'Justin Soyka', opp: 'dragapult', day: 1 })
    expect(t.rounds[1]).toMatchObject({ opponent: 'Marek Změlík', opp: 'ogerpon,hydrapple' })
    expect(t.rounds[12]).toMatchObject({ opponent: 'Milos Ristin', opp: 'lucario-mega,hariyama', day: 2 })
  })

  it('makes byes and no-shows out of rounds with no opponent', () => {
    const base = { round: 1, phase: 1, completed: 1, p1_id: 5, p2_id: null, p1_name: 'Me', p2_name: null, p1_deck: null, p2_deck: null, p1_icons: null, p2_icons: null }
    const t = (winner: number) => buildImport({ tournamentId: '1', playerId: '5', division: 'MA' },
      { type: 'regional', city: 'X', name: null, date: 'March 1, 2026', country: null, players: 8 },
      { name: 'Me', country: null, placement: 1, wins: 1, losses: 0, ties: 0, deck_id: null, deck_name: null, icons: null, drop_round: null },
      [{ ...base, winner }], null).rounds[0]
    expect(t(5)).toMatchObject({ special: 'bye', games: '' })
    expect(matchResult(t(-1))).toBe('L')
  })

  it('names decks the way the deck picker does', () => {
    expect(deckKey('dragapult-ex', 'dragapult')).toBe('dragapult')
    expect(deckKey('some-new-deck', 'zeraora-mega klefki')).toBe('zeraora-mega,klefki')
    expect(deckKey(null, null)).toBeNull()
  })

  it('writes the list as a TCG Live export', () => {
    const text = decklistText(decklist.message as LabsDecklist)
    expect(text.startsWith('Pokémon: 19\n4 Dreepy ASC 158')).toBe(true)
    expect(text).toContain('\n\nEnergy: 9\n4 Fire Energy MEE 2')
    expect(countryName('UK')).toBe('United Kingdom')
  })

  it('finds the saved deck that is the same list', () => {
    const list = decklistText(decklist.message as LabsDecklist)
    const live = list.replace('4 Fire Energy MEE 2', '4 Basic {R} Energy MEE 2').replace('Poké Pad', 'Poke Pad')
    expect(listDistance(list, live)).toBe(0)
    const twoOff = list.replace('4 Crushing Hammer', '2 Crushing Hammer').concat('\n2 Iono PAL 185')
    const decks = [{ id: 'a', decklist: twoOff }, { id: 'b', decklist: live }, { id: 'c', decklist: '' }]
    expect(closestDeck(decks, list)).toMatchObject({ deck: { id: 'b' }, off: 0 })
    expect(closestDeck([{ id: 'x', decklist: '4 Pikachu SVI 1' }], list)).toBeNull()
  })
})
