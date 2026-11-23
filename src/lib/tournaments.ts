/** In-person tournaments: types, and working out each round's result and the overall record. */

export const KINDS = [
  { key: 'locals', label: 'Locals' },
  { key: 'challenge', label: 'League Challenge' },
  { key: 'cup', label: 'League Cup' },
  { key: 'regionals', label: 'Regionals' },
  { key: 'special', label: 'Special Event' },
  { key: 'internationals', label: 'Internationals' },
  { key: 'worlds', label: 'Worlds' },
  { key: 'other', label: 'Other' },
] as const

export type Kind = (typeof KINDS)[number]['key']
export const kindLabel = (k: string) => KINDS.find((x) => x.key === k)?.label ?? 'Other'
export const isKind = (k: string): k is Kind => KINDS.some((x) => x.key === k)

export type GameResult = 'W' | 'L' | 'T'
export type MatchResult = 'W' | 'L' | 'T'

export interface Round {
  /** the opponent's deck key, as Limitless names decks: 'dragapult,crushing-hammer' */
  opp: string | null
  /** the games of the match in order: 'WLW', 'LWT' */
  games: string
  /** a bye counts as a win, an intentional draw as a tie, with no games played */
  special: 'bye' | 'id' | null
  opponent: string
  notes: string
  /** 2 for a round on day two of a big event; left out otherwise */
  day?: number
}

export interface Tournament {
  id: string
  name: string
  kind: Kind
  format: string
  location: string
  start_date: string
  end_date: string | null
  deck_id: string | null
  my_archetype: string | null
  placement: number | null
  players: number | null
  /** Championship Points earned; null when none were recorded */
  cp: number | null
  rounds: Round[]
  notes: string
  created_at: string
}

export const emptyRound = (): Round => ({ opp: null, games: '', special: null, opponent: '', notes: '' })

/** A round's games, keeping only W, L and T. */
export const cleanGames = (g: string) => g.toUpperCase().replace(/[^WLT]/g, '').slice(0, 5)

/** Who won the match: more game wins than losses is a win, the reverse a loss, level is a tie.
 * Nothing yet is null. */
export function matchResult(r: Pick<Round, 'games' | 'special'>): MatchResult | null {
  if (r.special === 'bye') return 'W'
  if (r.special === 'id') return 'T'
  const g = cleanGames(r.games)
  if (!g) return null
  const w = [...g].filter((x) => x === 'W').length
  const l = [...g].filter((x) => x === 'L').length
  return w > l ? 'W' : l > w ? 'L' : 'T'
}

export interface MatchRecord { w: number; l: number; t: number }

export function record(rounds: Pick<Round, 'games' | 'special'>[]): MatchRecord {
  const rec = { w: 0, l: 0, t: 0 }
  for (const r of rounds) {
    const m = matchResult(r)
    if (m) rec[m.toLowerCase() as 'w' | 'l' | 't']++
  }
  return rec
}

export const recordText = (r: MatchRecord) => `${r.w}-${r.l}-${r.t}`

/** Match points the way Play! Pokémon counts them: 3 a win, 1 a tie. */
export const matchPoints = (r: MatchRecord) => 3 * r.w + r.t

/** Rounds as they come out of the database, made safe to read. */
export function normaliseRounds(raw: unknown): Round[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => {
    const r = (x ?? {}) as Partial<Round>
    return {
      opp: typeof r.opp === 'string' && r.opp ? r.opp : null,
      games: cleanGames(typeof r.games === 'string' ? r.games : ''),
      special: r.special === 'bye' || r.special === 'id' ? r.special : null,
      opponent: typeof r.opponent === 'string' ? r.opponent.slice(0, 80) : '',
      notes: typeof r.notes === 'string' ? r.notes.slice(0, 500) : '',
      ...(r.day === 2 ? { day: 2 } : {}),
    }
  })
}

/** Whether round i is the first of day two. */
export const startsDay2 = (rounds: Pick<Round, 'day'>[], i: number) => (rounds[i]?.day ?? 1) > 1 && (rounds[i - 1]?.day ?? 1) === 1

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** '31 October 2026', or a range across days: '7–8 November 2026', '31 October – 1 November 2026'. */
export function dateRange(start: string, end?: string | null): string {
  const d = (s: string) => new Date(`${s}T12:00:00Z`)
  const fmt = (s: string, o: Intl.DateTimeFormatOptions) => d(s).toLocaleDateString('en-GB', { timeZone: 'UTC', ...o })
  if (!end || end === start) return fmt(start, { day: 'numeric', month: 'long', year: 'numeric' })
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  const sameMonth = sameYear && start.slice(0, 7) === end.slice(0, 7)
  if (sameMonth) return `${fmt(start, { day: 'numeric' })}–${fmt(end, { day: 'numeric', month: 'long', year: 'numeric' })}`
  if (sameYear) return `${fmt(start, { day: 'numeric', month: 'long' })} – ${fmt(end, { day: 'numeric', month: 'long', year: 'numeric' })}`
  return `${fmt(start, { day: 'numeric', month: 'long', year: 'numeric' })} – ${fmt(end, { day: 'numeric', month: 'long', year: 'numeric' })}`
}

/** Championship Points for an Ace Trainer card in a season. */
export const ACE_CP = 200

/**
 * The Play! Pokémon season an event counts towards, named by the year it ends: seasons run from
 * September to the end of August, so 31 October 2026 is in the 2027 season.
 */
export const seasonOf = (date: string) => {
  const [y, m] = date.split('-').map(Number)
  return m >= 9 ? y + 1 : y
}
/** '2026–27 season' */
export const seasonLabel = (season: number) => `${season - 1}–${String(season).slice(2)} season`

export interface SeasonCP {
  season: number
  total: number
  /** the events that earned CP, oldest first */
  events: { id: string; name: string; cp: number; start_date: string }[]
}

/** CP earned in a season, with each event that earned it. */
export function seasonCP(ts: Pick<Tournament, 'id' | 'name' | 'cp' | 'start_date'>[], season: number): SeasonCP {
  const events = ts.filter((t) => t.cp && t.cp > 0 && seasonOf(t.start_date) === season)
    .map((t) => ({ id: t.id, name: t.name, cp: t.cp!, start_date: t.start_date }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  return { season, total: events.reduce((n, e) => n + e.cp, 0), events }
}

/** '12th of 340', '3rd', or '' when no finish is set. */
export const finishText = (placement: number | null, players: number | null) =>
  placement ? `${ordinal(placement)}${players ? ` of ${players}` : ''}` : ''
