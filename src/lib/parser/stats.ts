/** One flat row of stats and loss tags per game. Port of the ptcg-pipeline build.py. */
import { parse, ParsedGame, TWO_PRIZERS_SUPPORT } from './parse'
import { cardSlug, esc, normalize } from './text'
import { baseArchetype, detectArchetype, withHammer } from './archetype'

// Per archetype: main attackers, the Basics that start those lines, and the line pieces that are liabilities early
interface Plan { attackers: Set<string>; lineBasics: Set<string>; lineEarly: Set<string> }
const PULT: Plan = { attackers: new Set(['Dragapult ex']), lineBasics: new Set(['Dreepy']), lineEarly: new Set(['Dreepy', 'Drakloak']) }
const PLANS: Record<string, Plan> = {
  dragapult: PULT,
  'dragapult,dusknoir': PULT,
  'starmie-mega,froslass-mega': {
    attackers: new Set(['Mega Starmie ex', 'Mega Froslass ex']),
    lineBasics: new Set(['Staryu', 'Snorunt']),
    lineEarly: new Set(['Staryu', 'Snorunt', 'Froslass']),
  },
}
const SUPPORT_EX = new Set([...TWO_PRIZERS_SUPPORT, 'Latias ex', 'Bloodmoon Ursaluna ex', 'Iron Thorns ex', 'Shaymin'])
SUPPORT_EX.delete('Squawkabilly ex')
const NON_DAMAGE = new Set(['Recon Directive', 'Flip the Script', 'Fighting Gong', 'Tuck Tail', 'Run Errand', 'Bubble Gathering'])
const BASIC_ENERGY = /^Basic \w+ Energy$/
const HAND_DISRUPTION = new Set(['Unfair Stamp', 'Judge', 'Iono', 'Roxanne', "Xerosic's Machinations", 'Eri', 'Marnie', 'Red Card', 'Special Red Card'])

/** A plan for decks without one: the attackers are the Pokémon the archetype is named after. */
function planFor(key: string | null, inPlay: string[]): Plan {
  const archetype = baseArchetype(key)
  if (archetype && PLANS[archetype]) return PLANS[archetype]
  const parts = new Set((archetype ?? '').split(','))
  return { attackers: new Set(inPlay.filter((p) => parts.has(cardSlug(p)))), lineBasics: new Set(), lineEarly: new Set() }
}

/** (my turn number, Pokémon) for each Pokémon `who` put into play; turn 0 = setup. */
export function enteredPlay(text: string, who: string): [number, string][] {
  const out: [number, string][] = []
  const q = esc(who)
  const re = new RegExp(`^-? ?${q} (?:played|drew) (.+?) (?:to|and played it to) the (?:Bench|Active Spot)`)
  const reMany = new RegExp(`^- ${q} drew \\d+ cards and played them to the Bench`)
  const lines = text.split('\n')
  let turn = 0
  lines.forEach((ln, i) => {
    const h = ln.match(/^(\S+)'s Turn$/)
    if (h) { if (h[1] === who) turn++; return }
    const m = ln.match(re)
    if (m && !m[1].includes('cards')) { out.push([turn, m[1]]); return }
    if (reMany.test(ln) && i + 1 < lines.length)
      for (const c of lines[i + 1].trim().replace(/^•+/, '').split(',')) out.push([turn, c.trim()])
  })
  return out
}

/** Every Pokémon name `who` evolved into, with the turn it happened. */
export function evolutions(text: string, who: string): [number, string][] {
  const out: [number, string][] = []
  const re = new RegExp(`^${esc(who)} evolved .+? to (.+?) (?:in the Active Spot|on the Bench)`)
  let turn = 0
  for (const ln of text.split('\n')) {
    const h = ln.match(/^(\S+)'s Turn$/)
    if (h) { if (h[1] === who) turn++; continue }
    const m = ln.match(re)
    if (m) out.push([turn, m[1]])
  }
  return out
}

/** Prize states, who took my prizes, the first prize trade, and the cards the opponent played. */
function extras(text: string, me: string, opp: string | null) {
  const q = esc(opp ?? '__OPP__'), qMe = esc(me)
  const reUsed = new RegExp(`^${qMe}'s (.+?) used (.+?)(?: on |\\.|$)`)
  const reOppPlayed = new RegExp(`^${q} played (.+?)(?: to the (?:Bench|Active Spot|Stadium spot))?\\.$`)
  const reOppAttached = new RegExp(`^${q} attached (.+?) to `)
  let meP = 0, oppP = 0
  const states: [number, number][] = [[0, 0]]
  let attacker: string | null = null
  const prizeBy: Record<string, number> = {}
  let closer: string | null = null
  let firstGiven: number | null = null, firstTaken: number | null = null
  const oppCards = new Set<string>()
  for (const ln of text.split('\n')) {
    if (/^\S+'s Turn$/.test(ln)) { attacker = null; continue }
    let m = ln.match(reUsed)
    if (m && !NON_DAMAGE.has(m[2])) attacker = m[1]
    if ((m = ln.match(reOppPlayed)) && !BASIC_ENERGY.test(m[1])) oppCards.add(m[1])
    if ((m = ln.match(reOppAttached)) && !BASIC_ENERGY.test(m[1])) oppCards.add(m[1])
    if ((m = ln.match(/^(\S+) took (a|\d+) Prize cards?\./))) {
      const k = m[2] === 'a' ? 1 : Number(m[2])
      if (m[1] === me) {
        meP += k
        const who = attacker ?? 'Ability or effect'
        prizeBy[who] = (prizeBy[who] ?? 0) + k
        closer = who
        firstTaken ??= k
      } else {
        oppP += k
        firstGiven ??= k
      }
      states.push([meP, oppP])
    }
  }
  return {
    states, prizeBy, closer, firstGiven, firstTaken, oppCards: [...oppCards].sort(),
    maxDeficit: Math.max(...states.map(([a, b]) => b - a)),
  }
}

/** Short labels for what went wrong (or was rough) in a game. A game can carry several. */
function tags(g: ParsedGame, text: string, x: ReturnType<typeof extras>, slow: boolean, supportKod: string[], earlyLineKo: number, idle: number, lost: boolean) {
  const opp = esc(g.opp ?? '__OPP__')
  const out: string[] = []
  if (g.myMulligans) out.push('Mulligan')
  if (slow && g.myTurns >= 3) out.push('Slow start')
  if (earlyLineKo) out.push("Line KO'd early")
  if (supportKod.length) out.push("Support ex KO'd")
  if (x.firstGiven && x.firstGiven >= 2 && g.firstPrize === 'opp') out.push('Gave up first KO on ex')
  if ((text.match(new RegExp(`^${opp}'s Budew used Itchy Pollen`, 'gm')) ?? []).length >= 2) out.push('Item locked')
  const denied = g.opp ? energyDenied(text, g.opp, g.me) : 0
  if (denied) out.push('Energy denied')
  if ([...text.matchAll(new RegExp(`^${opp} played (.+?)\\.$`, 'gm'))].some((m) => HAND_DISRUPTION.has(m[1]))) out.push('Hand disrupted')
  if (idle >= 2) out.push('Missed attacks')
  if (g.endReason === 'deckout' && lost) out.push('Decked out')
  if (g.endReason === 'i_conceded' && g.myTurns < 3) out.push('Early concede')
  if (!out.length && lost) out.push('Outpaced')
  return out
}

/** Energy the `by` player's trainers knocked off the other player's Pokémon. */
function energyDenied(text: string, by: string, from: string) {
  const rePlayed = new RegExp(`^${esc(by)} played (.+?)\\.$`)
  const reDiscard = new RegExp(`^- .*Energy was discarded from ${esc(from)}'s`)
  let last: string | null = null, n = 0
  for (const ln of text.split('\n')) {
    const m = ln.match(rePlayed)
    if (m) last = m[1]
    else if (!ln.startsWith('-')) last = null
    if (last && reDiscard.test(ln)) n++
  }
  return n
}

/** The other side of the loss tags: short labels for what went right in a game. */
function winTags(g: ParsedGame, text: string, x: ReturnType<typeof extras>, online: number | null, heads: number, won: boolean) {
  const me = esc(g.me)
  const out: string[] = []
  if (online !== null && online <= 2) out.push('Fast setup')
  if (g.openingActive === 'Budew') out.push('Budew open')
  if (g.oppMulligans) out.push('Opp mulligan')
  if (x.firstTaken && x.firstTaken >= 2 && g.firstPrize === 'me') out.push('Took first KO on ex')
  if (g.kos.some((k) => k.side === 'opp' && SUPPORT_EX.has(k.mon))) out.push("KO'd their support ex")
  if ((text.match(new RegExp(`^${me}'s Budew used Itchy Pollen`, 'gm')) ?? []).length >= 2) out.push('Item locked them')
  if (heads >= 2) out.push('Hammers hit')
  else if (g.opp && energyDenied(text, g.me, g.opp)) out.push('Energy denied them')
  if ([...text.matchAll(new RegExp(`^${me} played (.+?)\\.$`, 'gm'))].some((m) => HAND_DISRUPTION.has(m[1]))) out.push('Disrupted their hand')
  if (g.endReason === 'deckout' && won) out.push('Opp decked out')
  if (g.endReason === 'opp_conceded' && g.oppTurns < 3) out.push('Opp early concede')
  if (!out.length && won) out.push('Outpaced them')
  return out
}

export const END_REASONS: Record<string, string> = {
  opp_conceded: 'Opponent conceded', i_conceded: 'I conceded', prizes: 'Prizes',
  no_bench: 'No benched Pokémon', timeout: 'Opponent timed out', deckout: 'Deck out', other: 'Other',
}

export interface GameStats {
  me: string
  opponent: string | null
  /** null when the log was cut off before the game ended */
  result: 'W' | 'L' | null
  went_first: boolean | null
  won_flip: boolean
  my_archetype: string | null
  opp_archetype: string | null
  opening_active: string | null
  opening_hand: string[]
  mulligans: number
  opp_mulligans: number
  line_basics_by_t1: number
  line_basics_by_t2: number
  first_attacker_turn: number | null
  my_turns: number
  opp_turns: number
  prizes_taken: number
  prizes_given: number
  first_prize: 'Me' | 'Opponent' | 'None'
  support_ex_benched: string[]
  support_ex_kod: string[]
  early_line_kos: number
  dive_placements: number
  dive_converted: number
  idle_turns_after_online: number
  end_reason: string
  tags: string[]
  win_tags: string[]
  max_deficit: number
  first_given_prizes: number | null
  first_taken_prizes: number | null
  prize_states: [number, number][]
  prize_takers: Record<string, number>
  closer: string | null
  opp_cards: string[]
  opp_pokemon: string[]
  hammers_played: number
  hammer_heads: number
}

/**
 * Parse a raw log into stats. `archetype` is my deck's archetype slug when known (e.g. from the
 * deck it was uploaded against); otherwise it is detected from the Pokémon I played.
 */
export function gameStats(raw: string, opts: { me?: string; archetype?: string | null } = {}): GameStats {
  const g = parse(raw, opts.me)
  const text = normalize(raw)
  const ins = enteredPlay(text, g.me)
  const myMons = [...ins.map(([, p]) => p), ...evolutions(text, g.me).map(([, p]) => p)]
  const oppMons = g.opp ? [...enteredPlay(text, g.opp), ...evolutions(text, g.opp)].map(([, p]) => p) : []
  // a side that played Crushing Hammer is the hammer version of its deck (Hammer Pult)
  const hammered = (who: string | null, key: string | null) =>
    key && who && text.split('\n').includes(`${who} played Crushing Hammer.`) ? withHammer(key) : key
  const myArch = opts.archetype ?? hammered(g.me, detectArchetype(myMons))
  const oppArch = hammered(g.opp, detectArchetype(oppMons))
  const plan = planFor(myArch, myMons)

  const lineT1 = ins.filter(([t, p]) => plan.lineBasics.has(p) && t <= 1).length
  const lineT2 = ins.filter(([t, p]) => plan.lineBasics.has(p) && t <= 2).length
  const supportBenched = [...new Set(ins.map(([, p]) => p).filter((p) => SUPPORT_EX.has(p)))].sort()
  const supportKod = g.kos.filter((k) => k.side === 'me' && SUPPORT_EX.has(k.mon)).map((k) => k.mon)

  // Phantom Dive spread: did each placement's target get Knocked Out by me later in the game?
  const myKos = g.kos.filter((k) => k.side === 'opp')
  const conv = g.diveSpread.filter((s) => myKos.some((k) => k.mon === s.target && k.turn >= s.turn)).length
  // Turns after the main attacker came online where I did not attack (skip the turn it evolved)
  const online = evolutions(text, g.me).find(([, p]) => plan.attackers.has(p))?.[0] ?? null
  const idle = online ? g.turns.filter((t) => t.who === 'me' && t.n > online && !t.attacked).length : 0

  const win = g.winnerIsMe === true
  const slow = online === null || online > 3
  const earlyLineKo = g.kos.filter((k) => k.side === 'me' && plan.lineEarly.has(k.mon) && k.turn <= 3).length
  const x = extras(text, g.me, g.opp)
  let hammers = 0, heads = 0
  const tl = text.split('\n')
  tl.forEach((ln, i) => {
    if (ln !== `${g.me} played Crushing Hammer.`) return
    hammers++
    if (tl[i + 1] === `- ${g.me} flipped a coin and it landed on heads.`) heads++
  })
  return {
    me: g.me,
    opponent: g.opp,
    result: g.winnerIsMe === null ? null : win ? 'W' : 'L',
    went_first: g.wentFirst,
    won_flip: g.wonFlip,
    my_archetype: myArch,
    opp_archetype: oppArch,
    opening_active: g.openingActive,
    opening_hand: g.openingHand,
    mulligans: g.myMulligans,
    opp_mulligans: g.oppMulligans,
    line_basics_by_t1: lineT1,
    line_basics_by_t2: lineT2,
    first_attacker_turn: online,
    my_turns: g.myTurns,
    opp_turns: g.oppTurns,
    prizes_taken: g.prizesMe,
    prizes_given: g.prizesOpp,
    first_prize: g.firstPrize === 'me' ? 'Me' : g.firstPrize === 'opp' ? 'Opponent' : 'None',
    support_ex_benched: supportBenched,
    support_ex_kod: supportKod,
    early_line_kos: earlyLineKo,
    dive_placements: g.diveSpread.length,
    dive_converted: conv,
    idle_turns_after_online: idle,
    end_reason: END_REASONS[g.endReason],
    tags: tags(g, text, x, slow, supportKod, earlyLineKo, idle, g.winnerIsMe === false),
    win_tags: winTags(g, text, x, online, heads, win),
    max_deficit: x.maxDeficit,
    first_given_prizes: x.firstGiven,
    first_taken_prizes: x.firstTaken,
    prize_states: x.states,
    prize_takers: x.prizeBy,
    closer: win && (g.endReason === 'prizes' || g.endReason === 'no_bench') ? x.closer : null,
    opp_cards: x.oppCards,
    opp_pokemon: [...new Set(oppMons)].sort(),
    hammers_played: hammers,
    hammer_heads: heads,
  }
}
