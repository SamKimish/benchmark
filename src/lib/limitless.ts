/**
 * Importing a tournament run from Limitless Labs (labs.limitlesstcg.com/0079/player/1664).
 * The page is built from a public JSON feed; we read the same feed, server side, and turn it into
 * a tournament for the editor to prefill. Nothing is saved until you press Save.
 */
import { LIMITLESS } from './archetypes'
import { parseDecklist } from './decklist'
import type { Kind, Round } from './tournaments'

const API = 'https://mew.limitlesstcg.com/labs/data/tcg'

export interface LabsRef { tournamentId: string; playerId: string; division: string }

const DIVISIONS: Record<string, string> = { MA: 'MA', SR: 'SR', JR: 'JR' }

/**
 * A Labs player link, or most of one: 'https://labs.limitlesstcg.com/0079/player/1664',
 * '…/0079/SR/player/12/decklist', 'labs.limitlesstcg.com/0079/player/1664?x=1'. Null when it isn't one.
 */
export function parseLabsUrl(input: string): LabsRef | null {
  const s = input.trim()
  if (!s) return null
  let path: string
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    if (!/(^|\.)limitlesstcg\.com$/i.test(u.hostname)) return null
    path = u.pathname
  } catch {
    return null
  }
  const m = path.match(/^\/(\d{1,6})(?:\/(MA|SR|JR))?\/player\/(\d{1,6})(?:\/|$)/i)
  if (!m) return null
  return { tournamentId: m[1], division: DIVISIONS[(m[2] ?? 'MA').toUpperCase()], playerId: m[3] }
}

export const labsUrl = (r: LabsRef) =>
  `https://labs.limitlesstcg.com/${r.tournamentId}${r.division === 'MA' ? '' : `/${r.division}`}/player/${r.playerId}`

// --- the feed, as Limitless sends it ---------------------------------------------------------

export interface LabsTournament {
  type: string            // 'regional', 'special', 'international', 'worlds'
  city: string | null
  name: string | null
  date: string            // 'October 31–November 1, 2026'
  country: string | null  // 'PL'
  players: number | null
}
export interface LabsPlayer {
  name: string
  country: string | null
  placement: number | null
  wins: number; losses: number; ties: number
  deck_id: string | null  // 'dragapult-ex'
  deck_name: string | null
  icons: string | null    // 'dragapult' or 'lucario-mega hariyama'
  drop_round: number | null
}
export interface LabsMatch {
  round: number
  phase: number
  completed: number
  /** the winner's id; 0 a tie, -1 nobody (a late arrival or no-show) */
  winner: number
  p1_id: number | null; p2_id: number | null
  p1_name: string | null; p2_name: string | null
  p1_deck: string | null; p2_deck: string | null
  p1_icons: string | null; p2_icons: string | null
}
export interface LabsCard { count: number; name: string; set: string; number: string }
export interface LabsDecklist { pokemon?: LabsCard[]; trainer?: LabsCard[]; energy?: LabsCard[] }

// --- turning it into a tournament -----------------------------------------------------------

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/**
 * Labs writes dates for people: 'October 31–November 1, 2026', 'November 8–9, 2026', 'March 1, 2026',
 * 'December 30, 2026–January 2, 2027'. Gives ISO dates, end null for a one-day event.
 */
export function parseLabsDate(s: string): { start: string; end: string | null } | null {
  const parts = s.replace(/\s+/g, ' ').trim().split(/\s*[–—-]\s*/)
  const read = (p: string) => {
    const m = p.match(/^(?:([A-Za-z]+) )?(\d{1,2})(?:, (\d{4}))?$/)
    if (!m) return null
    const month = m[1] ? MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))) : null
    return { month: month === -1 ? undefined : month, day: Number(m[2]), year: m[3] ? Number(m[3]) : null }
  }
  const a = read(parts[0]), b = parts[1] ? read(parts[1]) : null
  if (!a || a.month === undefined || a.month === null || (parts[1] && !b) || (b && b.month === undefined)) return null
  const endYear = b?.year ?? a.year
  if (!endYear) return null
  const endMonth = b ? b.month ?? a.month : a.month
  // a range across New Year: the start is the year before
  const startYear = a.year ?? (b && endMonth < a.month ? endYear - 1 : endYear)
  const start = iso(startYear, a.month, a.day)
  const end = b ? iso(endYear, endMonth, b.day) : null
  return { start, end: end && end !== start ? end : null }
}

const KIND: Record<string, Kind> = {
  regional: 'regionals', special: 'special', international: 'internationals', worlds: 'worlds',
  cup: 'cup', 'league cup': 'cup', challenge: 'challenge',
}
const SHORT: Partial<Record<Kind, string>> = { regionals: 'Regionals', special: 'Special Event', internationals: 'Internationals', worlds: 'Worlds' }

const COUNTRY_CODE: Record<string, string> = { UK: 'GB' }
export function countryName(code: string | null | undefined): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(COUNTRY_CODE[code] ?? code) ?? code
  } catch {
    return code
  }
}

/** A Limitless deck as our deck key: 'lucario-hariyama' -> 'lucario-mega,hariyama'. */
export function deckKey(deckId: string | null | undefined, icons: string | null | undefined): string | null {
  const known = deckId ? LIMITLESS.find((a) => a.id === deckId) : undefined
  if (known) return known.key
  const slugs = (icons ?? '').trim().split(/\s+/).filter(Boolean)
  return slugs.length ? slugs.slice(0, 2).join(',') : null
}

/** A Labs list as a TCG Live export, so it can be saved to Decks like a pasted one. */
export function decklistText(d: LabsDecklist | null | undefined): string {
  if (!d) return ''
  const section = (title: string, cards: LabsCard[] = []) => cards.length
    ? [`${title}: ${cards.reduce((n, c) => n + c.count, 0)}`, ...cards.map((c) => `${c.count} ${c.name} ${c.set} ${c.number}`)].join('\n')
    : ''
  return [section('Pokémon', d.pokemon), section('Trainer', d.trainer), section('Energy', d.energy)].filter(Boolean).join('\n\n')
}

/** Labs rounds always know their day. */
export type ImportedRound = Round & { day: number }

export interface ImportedTournament {
  source: string
  player: string
  name: string
  kind: Kind
  format: string
  location: string
  start_date: string
  end_date: string | null
  placement: number | null
  players: number | null
  my_archetype: string | null
  deck_name: string | null
  /** the list Sam registered, as a TCG Live export; '' when Labs hasn't published lists */
  decklist: string
  rounds: ImportedRound[]
  record: { w: number; l: number; t: number }
  /** dropped after this round */
  dropped: number | null
  day2: boolean
}

/**
 * The tournament from the four Labs feeds. Labs only has match results, not games, so each round gets
 * one game standing for the result ('W', 'L', 'T') for you to fill in. A round with no opponent is a
 * bye when you won it; a round nobody won (late, no-show) is a loss.
 */
export function buildImport(ref: LabsRef, t: LabsTournament, p: LabsPlayer, matches: LabsMatch[], deck: LabsDecklist | null): ImportedTournament {
  const me = Number(ref.playerId)
  const kind = KIND[t.type?.toLowerCase()] ?? 'other'
  const dates = parseLabsDate(t.date ?? '')
  const name = (t.name?.trim() || [t.city, SHORT[kind] ?? 'Tournament'].filter(Boolean).join(' ')).slice(0, 120)
  const rounds = [...matches]
    .filter((m) => m.p1_id === me || m.p2_id === me)
    .sort((a, b) => a.round - b.round)
    .map((m): ImportedRound => {
      const first = m.p1_id === me
      const oppId = first ? m.p2_id : m.p1_id
      const oppName = (first ? m.p2_name : m.p1_name) ?? ''
      const opp = deckKey(first ? m.p2_deck : m.p1_deck, first ? m.p2_icons : m.p1_icons)
      const base = { opp, opponent: oppName.slice(0, 80), notes: '', day: m.phase > 1 ? 2 : 1 }
      if (!oppId) {
        return m.winner === me
          ? { ...base, opp: null, games: '', special: 'bye' }
          : { ...base, opp: null, games: 'L', special: null, notes: 'No opponent: a late arrival or no-show counted as a loss' }
      }
      const games = m.winner === me ? 'W' : m.winner === 0 ? 'T' : 'L'
      return { ...base, games, special: null }
    })
  return {
    source: labsUrl(ref),
    player: p.name,
    name,
    kind,
    format: 'Standard',
    location: [t.city, countryName(t.country)].filter(Boolean).join(', ').slice(0, 120),
    start_date: dates?.start ?? '',
    end_date: dates?.end ?? null,
    placement: p.placement || null,
    players: t.players || null,
    my_archetype: deckKey(p.deck_id, p.icons),
    deck_name: p.deck_name,
    decklist: decklistText(deck),
    rounds,
    record: { w: p.wins ?? 0, l: p.losses ?? 0, t: p.ties ?? 0 },
    dropped: p.drop_round ?? null,
    day2: rounds.some((r) => r.day > 1),
  }
}

/** Fetch a run from Labs. Throws a message fit to show when the link is wrong or Limitless is down. */
export async function fetchLabs(ref: LabsRef): Promise<ImportedTournament> {
  const get = async <T,>(path: string, optional = false): Promise<T | null> => {
    const res = await fetch(`${API}/${path}`, { headers: { accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .catch(() => { throw new Error("Couldn't reach Limitless. Try again in a minute.") })
    const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: unknown } | null
    if (!res.ok || !body?.ok) {
      if (optional) return null
      throw new Error(res.status >= 500 ? 'Limitless is having trouble right now. Try again in a minute.' : "Limitless doesn't have that player at that tournament.")
    }
    return body.message as T
  }
  const q = `tournamentId=${encodeURIComponent(ref.tournamentId)}&playerId=${encodeURIComponent(ref.playerId)}`
  const [t, p, m, d] = await Promise.all([
    get<LabsTournament>(`tournament?id=${encodeURIComponent(ref.tournamentId)}&division=${ref.division}`),
    get<LabsPlayer>(`player?${q}`),
    get<LabsMatch[]>(`matches?${q}`),
    get<LabsDecklist>(`decklist?${q}`, true),
  ])
  if (!t || !p) throw new Error("Limitless doesn't have that player at that tournament.")
  return buildImport(ref, t, p, Array.isArray(m) ? m : [], d)
}

// --- matching the list to one already in Decks ---------------------------------------------

const norm = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^basic /, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()

const counts = (text: string) => {
  const m = new Map<string, number>()
  for (const e of parseDecklist(text)) m.set(norm(e.name), (m.get(norm(e.name)) ?? 0) + e.count)
  return m
}

/** How many cards you'd have to swap to turn one list into the other: 0 is the same 60. */
export function listDistance(a: string, b: string): number {
  const x = counts(a), y = counts(b)
  let diff = 0
  for (const k of new Set([...x.keys(), ...y.keys()])) diff += Math.abs((x.get(k) ?? 0) - (y.get(k) ?? 0))
  return Math.ceil(diff / 2)
}

/** The saved deck closest to the list you played, if any is within a handful of cards. */
export function closestDeck<D extends { id: string; decklist: string }>(decks: D[], list: string, within = 6): { deck: D; off: number } | null {
  if (!list.trim()) return null
  let best: { deck: D; off: number } | null = null
  for (const d of decks) {
    if (!d.decklist?.trim()) continue
    const off = listDistance(d.decklist, list)
    if (off <= within && (!best || off < best.off)) best = { deck: d, off }
  }
  return best
}
