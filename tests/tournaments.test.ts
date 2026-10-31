import { describe, expect, it } from 'vitest'
import { cleanGames, dateRange, finishText, matchPoints, matchResult, normaliseRounds, ordinal, record, recordText } from '../src/lib/tournaments'

const r = (games: string, special: 'bye' | 'id' | null = null) => ({ games, special })

describe('tournaments', () => {
  it('works out who won each match', () => {
    expect(matchResult(r('WLW'))).toBe('W')
    expect(matchResult(r('LWL'))).toBe('L')
    expect(matchResult(r('LWT'))).toBe('T')
    expect(matchResult(r('WT'))).toBe('W')
    expect(matchResult(r(''))).toBeNull()
    expect(matchResult(r('', 'bye'))).toBe('W')
    expect(matchResult(r('', 'id'))).toBe('T')
  })

  it('adds up a record like the Training Court sheet: 5-2-1', () => {
    const rounds = ['LWT', 'WLW', 'WW', 'WW', 'WLW', 'LL', 'LWL', 'WW'].map((g) => r(g))
    const rec = record(rounds)
    expect(recordText(rec)).toBe('5-2-1')
    expect(matchPoints(rec)).toBe(16)
  })

  it('keeps only game results', () => {
    expect(cleanGames('w l-w')).toBe('WLW')
    expect(cleanGames('WWWWWWW')).toBe('WWWWW')
  })

  it('reads rounds from the database safely', () => {
    expect(normaliseRounds(null)).toEqual([])
    expect(normaliseRounds([{ opp: 'dragapult', games: 'wl', special: 'nope' }])).toEqual([
      { opp: 'dragapult', games: 'WL', special: null, opponent: '', notes: '' },
    ])
  })

  it('writes finishes and dates', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 112].map(ordinal)).toEqual(
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '112th'])
    expect(finishText(12, 340)).toBe('12th of 340')
    expect(finishText(null, 30)).toBe('')
    expect(dateRange('2026-10-31')).toBe('31 October 2026')
    expect(dateRange('2026-10-31', '2026-11-01')).toBe('31 October – 1 November 2026')
    expect(dateRange('2026-11-07', '2026-11-08')).toBe('7–8 November 2026')
  })
})
