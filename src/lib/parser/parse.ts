/** Parse a TCG Live game log into a game record. Port of the ptcg-pipeline parse.py. */
import { detectMe, esc, normalize, splitCards } from './text'

export const TWO_PRIZERS_SUPPORT = new Set(['Meowth ex', 'Fezandipiti ex', "Lillie's Clefairy ex", 'Squawkabilly ex'])
// abilities are also "used"; these are never attacks
const ABILITIES = new Set(['Recon Directive', 'Flip the Script', 'Adrena-Brain', 'Fighting Gong'])

export type Side = 'me' | 'opp'
export interface Turn { who: Side; n: number; attacked: boolean; lines: string[] }
export interface KO { turnIdx: number; turn: number; by: Side; side: Side; mon: string }
export interface PrizeEvent { turnIdx: number; side: Side; n: number; me: number; opp: number }
export type EndReason = 'i_conceded' | 'opp_conceded' | 'prizes' | 'no_bench' | 'timeout' | 'deckout' | 'other'

export interface ParsedGame {
  me: string
  opp: string | null
  wentFirst: boolean | null
  wonFlip: boolean
  myMulligans: number
  oppMulligans: number
  openingHand: string[]
  openingActive: string | null
  turns: Turn[]
  myTurns: number
  oppTurns: number
  prizesMe: number
  prizesOpp: number
  prizeTimeline: PrizeEvent[]
  kos: KO[]
  firstPultTurn: number | null
  firstDiveTurn: number | null
  diveSpread: { turn: number; counters: number; target: string }[]
  noAttackTurns: number[]
  myAttacks: number
  cardsPlayed: string[]
  benched: string[]
  endLine: string
  winnerIsMe: boolean | null
  endReason: EndReason
  firstPrize: Side | null
}

export class LogError extends Error {}

export function parse(raw: string, me?: string): ParsedGame {
  const text = normalize(raw)
  const lines = text.split('\n')
  const ME = me ?? detectMe(text)
  if (!ME) throw new LogError("Couldn't find whose log this is (no opening hand listed). Is this a TCG Live game export?")
  const names = new Set([...text.matchAll(/^(\S+)'s Turn$/gm)].map((m) => m[1]))
  if (!names.size) throw new LogError('No turns found. Is this a TCG Live game export?')
  const opp = [...names].find((n) => n !== ME) ?? null
  const O = opp ?? '__OPP__'
  const qMe = esc(ME), qOpp = esc(O)

  let wentFirst: boolean | null = null
  let m = text.match(new RegExp(`${qMe} decided to go (first|second)`))
  if (m) wentFirst = m[1] === 'first'
  else if ((m = text.match(new RegExp(`${qOpp} decided to go (first|second)`)))) wentFirst = m[1] !== 'first'

  const mulls = (who: string) =>
    [...text.matchAll(new RegExp(`^${esc(who)} took (a|\\d+) mulligans?\\.`, 'gm'))]
      .reduce((s, x) => s + (x[1] === 'a' ? 1 : Number(x[1])), 0)

  // opening hand: the bullet after the last "ME drew 7 cards for the opening hand" (after mulligans)
  let openingHand: string[] = []
  lines.forEach((ln, i) => {
    if (!ln.startsWith(`${ME} drew 7 cards for the opening hand`)) return
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      if (lines[j].trim().startsWith('•')) { openingHand = splitCards(lines[j].trim().slice(1)); break }
    }
  })
  m = text.match(new RegExp(`^${qMe} played (.+?) to the Active Spot`, 'm'))
  const openingActive = m ? m[1] : null

  const turns: Turn[] = []
  const turnNo: Record<string, number> = { [ME]: 0, [O]: 0 }
  let cur: Turn | null = null
  for (const ln of lines) {
    const h = ln.match(/^(\S+)'s Turn$/)
    if (h) {
      turnNo[h[1]] = (turnNo[h[1]] ?? 0) + 1
      cur = { who: h[1] === ME ? 'me' : 'opp', n: turnNo[h[1]], attacked: false, lines: [] }
      turns.push(cur)
    } else if (cur && ln.trim()) cur.lines.push(ln)
  }

  const kos: KO[] = []
  const prizes = { me: 0, opp: 0 }
  const prizeTimeline: PrizeEvent[] = []
  let firstPult: number | null = null, firstDive: number | null = null
  const diveSpread: ParsedGame['diveSpread'] = []
  const attacks = { me: 0, opp: 0 }
  const noAttackTurns: number[] = []
  const played: string[] = []
  const bench = new Set<string>()
  const reUsed = { me: new RegExp(`^${qMe}'s (.+?) used (.+?)(?: on |\\.|$)`), opp: new RegExp(`^${qOpp}'s (.+?) used (.+?)(?: on |\\.|$)`) }
  const reEvolved = new RegExp(`^${qMe} evolved (.+?) to (.+?) (?:in the Active Spot|on the Bench)`)
  const rePlayed = new RegExp(`^${qMe} played (.+?)(?: to the (Bench|Active Spot|Stadium spot))?\\.$`)
  const reCounters = new RegExp(`^- ${qMe} put (\\d+) damage counters on .+?['’]s (.+?)\\.$`)

  turns.forEach((t, ti) => {
    const side = t.who
    let inDive = false
    for (const ln of t.lines) {
      if (!ln.startsWith('-') && !ln.startsWith(' ')) inDive = ln.includes('used Phantom Dive')
      let x = ln.match(reUsed[side])
      if (x && !ABILITIES.has(x[2]) && ln.includes(' on ')) {
        t.attacked = true
        attacks[side]++
        if (side === 'me' && x[2] === 'Phantom Dive' && firstDive === null) firstDive = t.n
      }
      if (side === 'me') {
        if ((x = ln.match(reEvolved)) && x[2] === 'Dragapult ex' && firstPult === null) firstPult = t.n
        if ((x = ln.match(rePlayed))) {
          played.push(x[1])
          if (x[2] === 'Bench') bench.add(x[1])
        }
        if ((x = ln.match(reCounters)) && inDive) diveSpread.push({ turn: t.n, counters: Number(x[1]), target: x[2] })
      }
      if ((x = ln.match(/^(\S+)'s (.+?) was Knocked Out!/)))
        kos.push({ turnIdx: ti, turn: t.n, by: side, side: x[1] === ME ? 'me' : 'opp', mon: x[2] })
      if ((x = ln.match(/^(\S+) took (a|\d+) Prize cards?\./))) {
        const k = x[2] === 'a' ? 1 : Number(x[2])
        const s: Side = x[1] === ME ? 'me' : 'opp'
        prizes[s] += k
        prizeTimeline.push({ turnIdx: ti, side: s, n: k, me: prizes.me, opp: prizes.opp })
      }
    }
    if (side === 'me' && !t.attacked) noAttackTurns.push(t.n)
  })

  // end reason, from the final line (TCG Live writes it from the exporter's point of view)
  const nonEmpty = lines.filter((l) => l.trim())
  const endLine = nonEmpty[nonEmpty.length - 1] ?? ''
  const w = endLine.match(/(\S+) wins\.?$/)
  const ends: [string, EndReason][] = [['You conceded', 'i_conceded'], ['Opponent conceded', 'opp_conceded'],
    ['Prize cards', 'prizes'], ['No Benched', 'no_bench'], ['inactive', 'timeout'], ['ran out of cards', 'deckout']]
  const endReason = ends.find(([p]) => endLine.includes(p))?.[1] ?? 'other'

  return {
    me: ME, opp, wentFirst, wonFlip: text.includes(`${ME} won the coin toss`),
    myMulligans: mulls(ME), oppMulligans: mulls(O), openingHand, openingActive,
    turns, myTurns: turnNo[ME] ?? 0, oppTurns: turnNo[O] ?? 0,
    prizesMe: prizes.me, prizesOpp: prizes.opp, prizeTimeline, kos,
    firstPultTurn: firstPult, firstDiveTurn: firstDive, diveSpread, noAttackTurns, myAttacks: attacks.me,
    cardsPlayed: [...new Set(played)].sort(), benched: [...bench].sort(),
    endLine, winnerIsMe: w ? w[1] === ME : null, endReason,
    firstPrize: prizeTimeline[0]?.side ?? null,
  }
}
