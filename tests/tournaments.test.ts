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

describe('Championship Points', () => {
  it('puts events in the season they count towards', async () => {
    const { seasonOf, seasonLabel } = await import('../src/lib/tournaments')
    expect(seasonOf('2026-10-31')).toBe(2027)
    expect(seasonOf('2026-09-01')).toBe(2027)
    expect(seasonOf('2026-08-30')).toBe(2026)
    expect(seasonOf('2027-04-12')).toBe(2027)
    expect(seasonLabel(2027)).toBe('2026–27 season')
  })
  it('adds up a season, oldest event first, leaving out other seasons and events without CP', async () => {
    const { seasonCP } = await import('../src/lib/tournaments')
    const t = (id: string, start_date: string, cp: number | null) => ({ id, name: id, start_date, cp })
    const s = seasonCP([t('gdansk', '2026-10-31', 45), t('cup', '2026-10-12', 15), t('locals', '2026-09-26', null), t('worlds', '2026-08-20', 500)], 2027)
    expect(s.total).toBe(60)
    expect(s.events.map((e) => e.id)).toEqual(['cup', 'gdansk'])
  })
})
