/**
 * A game log as a list of turns and events, for drawing it as a readable timeline instead of raw text.
 * Each main line of the log is one event; its "- …" lines are details and its "• …" lines are cards.
 */
import { parse, type Side } from './parse'
import { esc, normalize, splitCards } from './text'

export type EventKind =
  | 'attack' | 'ability' | 'ko' | 'prize' | 'evolve' | 'bench' | 'active' | 'stadium' | 'trainer'
  | 'attach' | 'retreat' | 'switch' | 'draw' | 'coin' | 'mulligan' | 'hand' | 'other'

export interface LogEvent {
  kind: EventKind
  who: Side | null
  /** the line with the players' names swapped for "You" and the opponent's name kept */
  text: string
  /** the Pokémon acting, evolving, played or Knocked Out */
  mon?: string
  /** the card played or attached, or the attack or ability used */
  card?: string
  /** what an evolution came from, or what an attack or attachment went onto */
  target?: string
  damage?: number
  /** prizes taken */
  n?: number
  /** prizes after this event, mine then theirs */
  score?: [number, number]
  details: string[]
  cards: string[]
}

export interface TimelineTurn { who: Side; n: number; events: LogEvent[]; score: [number, number] }
export interface Timeline { me: string; opp: string | null; setup: LogEvent[]; turns: TimelineTurn[]; end: string }

const KEY_KINDS = new Set<EventKind>(['attack', 'ko', 'prize', 'evolve', 'stadium'])
/** The events worth seeing when skimming: attacks, KOs, prizes, evolutions, Supporters and Stadiums. */
export const isKeyEvent = (e: LogEvent, supporters: Set<string>) =>
  KEY_KINDS.has(e.kind) || (e.kind === 'trainer' && !!e.card && supporters.has(e.card))

export function timeline(raw: string): Timeline {
  const g = parse(raw)
  const me = g.me, opp = g.opp ?? '__OPP__'
  const who = (name: string): Side | null => (name === me ? 'me' : name === opp ? 'opp' : null)
  // the exporter reads as "You": "Kimish17's Budew" -> "Your Budew", "… on Kimish17’s Budew" -> "… on your Budew"
  const you = (s: string) => (s.startsWith(`${me} `) || s.startsWith(`${me}'s `) ? s.replace(/\btheir\b/g, 'your') : s)
    .replace(new RegExp(`^${esc(me)}['’]s `), 'Your ').replace(new RegExp(`${esc(me)}['’]s `, 'g'), 'your ')
    .replace(new RegExp(`^${esc(me)} `), 'You ').replace(new RegExp(`\\b${esc(me)}\\b`, 'g'), 'you')

  const lines = normalize(raw).split('\n')
  const nonEmpty = lines.filter((l) => l.trim())
  const endLine = nonEmpty[nonEmpty.length - 1] ?? ''
  const isEnd = (ln: string) => ln === endLine && /wins|conceded|Prize cards|Benched|inactive|ran out/.test(ln)

  const setup: LogEvent[] = []
  const turns: TimelineTurn[] = []
  const score: [number, number] = [0, 0]
  const count: Record<Side, number> = { me: 0, opp: 0 }
  let list = setup
  let last: LogEvent | null = null

  for (const raw of lines) {
    const ln = raw.trimEnd()
    if (!ln.trim() || ln === 'Setup' || isEnd(ln)) continue
    const h = ln.match(/^(\S+)'s Turn$/)
    if (h) {
      const side = who(h[1]) ?? 'opp'
      const turn: TimelineTurn = { who: side, n: ++count[side], events: [], score: [0, 0] }
      turns.push(turn)
      list = turn.events
      last = null
      continue
    }
    const t = ln.trim()
    if (t.startsWith('•')) {
      const body = t.slice(1).trim()
      // attack damage breakdowns are bullets too, but they read better as details
      if (last && /damage$/.test(body)) last.details.push(body)
      else if (last) last.cards.push(...splitCards(body))
      continue
    }
    if (t.startsWith('-')) {
      if (last) last.details.push(you(t.slice(1).trim()))
      continue
    }
    if (/ ended their turn\.$/.test(t)) continue
    const e = event(t, who, you)
    // lines about no one in particular ("A card was added to …'s hand") belong to what came before
    if (e.kind === 'other' && !e.who && last) { last.details.push(e.text); continue }
    if (e.kind === 'prize') {
      score[e.who === 'me' ? 0 : 1] += e.n ?? 0
      e.score = [score[0], score[1]]
    }
    list.push(e)
    last = e
    if (turns.length) turns[turns.length - 1].score = [score[0], score[1]]
  }
  // "All Prize cards taken. Kimish17 wins." -> "You won. All Prize cards taken."
  const reason = endLine.replace(/\s*\S+ wins\.?$/, '').trim()
  const winner = g.winnerIsMe === null ? null : g.winnerIsMe ? 'You won.' : `${g.opp ?? 'Your opponent'} won.`
  return { me, opp: g.opp, setup, turns, end: winner ? `${winner} ${reason}`.trim() : 'The log ends before the game does.' }
}

function event(t: string, who: (n: string) => Side | null, you: (s: string) => string): LogEvent {
  const base = { text: you(t), details: [] as string[], cards: [] as string[] }
  let m
  if ((m = t.match(/^(\S+)'s (.+?) used (.+?) on (\S+?)['’]s (.+?) for (\d+) damage/)))
    return { ...base, kind: 'attack', who: who(m[1]), mon: m[2], card: m[3], target: m[5], damage: Number(m[6]) }
  if ((m = t.match(/^(\S+)'s (.+?) used (.+?)\.$/)) || (m = t.match(/^(\S+)'s (.+?) used (.+?)(?: on |$)/)))
    return { ...base, kind: 'ability', who: who(m[1]), mon: m[2], card: m[3] }
  if ((m = t.match(/^(\S+)'s (.+?) was Knocked Out!/))) return { ...base, kind: 'ko', who: who(m[1]), mon: m[2] }
  if ((m = t.match(/^(\S+) took (a|\d+) Prize cards?\./)))
    return { ...base, kind: 'prize', who: who(m[1]), n: m[2] === 'a' ? 1 : Number(m[2]) }
  if ((m = t.match(/^(\S+) evolved (.+?) to (.+?) (?:in the Active Spot|on the Bench)/)))
    return { ...base, kind: 'evolve', who: who(m[1]), target: m[2], mon: m[3] }
  if ((m = t.match(/^(\S+) played (.+?) to the (Bench|Active Spot)\.$/)))
    return { ...base, kind: m[3] === 'Bench' ? 'bench' : 'active', who: who(m[1]), mon: m[2] }
  if ((m = t.match(/^(\S+) played (.+?) to the Stadium spot\.$/))) return { ...base, kind: 'stadium', who: who(m[1]), card: m[2] }
  if ((m = t.match(/^(\S+) played (.+?)\.$/))) return { ...base, kind: 'trainer', who: who(m[1]), card: m[2] }
  if ((m = t.match(/^(\S+) attached (.+?) to (.+?)(?: in the Active Spot| on the Bench)?\.$/)))
    return { ...base, kind: 'attach', who: who(m[1]), card: m[2], target: m[3] }
  if ((m = t.match(/^(\S+) retreated (.+?) to the Bench\./))) return { ...base, kind: 'retreat', who: who(m[1]), mon: m[2] }
  if ((m = t.match(/^(\S+)'s (.+?) is now in the Active Spot\./))) return { ...base, kind: 'switch', who: who(m[1]), mon: m[2] }
  if ((m = t.match(/^(\S+) drew 7 cards for the opening hand/))) return { ...base, kind: 'hand', who: who(m[1]) }
  if ((m = t.match(/^(\S+) drew /))) return { ...base, kind: 'draw', who: who(m[1]) }
  if ((m = t.match(/^(\S+) took (a|\d+) mulligans?/))) return { ...base, kind: 'mulligan', who: who(m[1]) }
  if ((m = t.match(/^(\S+) (?:chose|won|decided|flipped)/))) return { ...base, kind: 'coin', who: who(m[1]) }
  m = t.match(/^(\S+?)(?:['’]s)? /)
  return { ...base, kind: 'other', who: m ? who(m[1]) : null }
}

export interface Knockout { turn: number; who: Side; mon: string; prizes: number; score: [number, number] | null }
/** Every Knockout in order, with the prizes it gave up and the score after. `turn` counts both players' turns. */
export function knockouts(tl: Timeline): Knockout[] {
  const out: Knockout[] = []
  tl.turns.forEach((t, i) => {
    for (const e of t.events) {
      if (e.kind === 'ko' && e.who && e.mon) out.push({ turn: i + 1, who: e.who, mon: e.mon, prizes: 0, score: null })
      if (e.kind === 'prize') {
        // a prize goes with the latest Knockout of the other side's Pokémon that hasn't been paid out
        const ko = [...out].reverse().find((k) => k.who !== e.who && !k.score)
        if (ko) { ko.prizes = e.n ?? 0; ko.score = e.score ?? null }
      }
    }
  })
  return out
}
