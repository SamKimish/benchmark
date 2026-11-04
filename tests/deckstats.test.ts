import { describe, expect, it } from 'vitest'
import { deckStats, winRate } from '../src/lib/deckstats'
import { gameSprites, sameSprites, spritesOf } from '../src/lib/archetypes'

describe('deckStats', () => {
  const games = [
    { deck_id: 'a', result: 'W' as const, went_first: true, opp_archetype: 'gardevoir', played_at: '2026-11-01T10:00:00Z' },
    { deck_id: 'a', result: 'L' as const, went_first: false, opp_archetype: 'gardevoir', played_at: '2026-11-02T10:00:00Z' },
    { deck_id: 'b', result: 'W' as const, went_first: false, opp_archetype: 'dragapult', played_at: '2026-11-03T10:00:00Z' },
    { deck_id: 'b', result: null, went_first: true, opp_archetype: 'dragapult', played_at: '2026-10-30T10:00:00Z' },
  ]
  it('counts games, wins and the win rate over finished games', () => {
    const s = deckStats(games)
    expect(s.all).toEqual({ games: 4, wins: 2, losses: 1 })
    expect(winRate(s.all)).toBeCloseTo(2 / 3)
    expect(s.first).toEqual({ games: 2, wins: 1, losses: 0 })
    expect(s.second).toEqual({ games: 2, wins: 1, losses: 1 })
    expect(s.lastPlayed).toBe('2026-11-03T10:00:00Z')
    expect(s.byDeck.get('b')).toEqual({ games: 2, wins: 1, losses: 0 })
    expect(s.matchups[0]).toEqual({ opp: 'gardevoir', games: 2, wins: 1, losses: 1 })
  })
  it('has no win rate without finished games', () => {
    expect(winRate({ games: 1, wins: 0, losses: 0 })).toBeNull()
  })
})

describe('deck sprites', () => {
  it('uses chosen sprites, else the archetype', () => {
    expect(spritesOf({ sprites: ['dragapult', 'dusknoir'], archetype: 'gardevoir' })).toEqual(['dragapult', 'dusknoir'])
    expect(spritesOf({ sprites: [], archetype: 'dragapult,crushing-hammer' })).toEqual(['dragapult', 'crushing-hammer'])
  })
  it('a game keeps its own sprites over its deck', () => {
    const deck = { sprites: ['dragapult'], archetype: 'dragapult' }
    expect(gameSprites({ my_sprites: ['dreepy'] }, deck)).toEqual(['dreepy'])
    expect(gameSprites({ my_sprites: [] }, deck)).toEqual(['dragapult'])
    expect(gameSprites({ my_sprites: [], my_archetype: 'gardevoir' }, null)).toEqual(['gardevoir'])
  })
  it('compares in order', () => {
    expect(sameSprites(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(sameSprites(['a', 'b'], ['b', 'a'])).toBe(false)
  })
})
