/** TCG Live decklists: parse, format, and card images (Limitless's CDN, keyed by set code and number). */

export interface Card {
  n: string     // name
  s: string     // TCG Live set code, 'TWM'
  no: string    // collector number
  t: 'P' | 'T' | 'E'
  st: string    // subtypes, 'Basic' / 'Stage 1' / 'Supporter' / 'Item' / 'Pokémon Tool' / 'Stadium'
  ef?: string   // evolves from
}

export interface Entry { count: number; name: string; set: string; no: string; t: Card['t'] | null }

const SECTION: Record<string, Card['t']> = { pokemon: 'P', pokémon: 'P', trainer: 'T', energy: 'E' }
const ENERGY_SYMBOL: Record<string, string> = { G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal' }
const SYMBOL = Object.fromEntries(Object.entries(ENERGY_SYMBOL).map(([k, v]) => [v, k]))

/** TCG Live writes promos as PR-SV / PR-ME; the card data and Limitless use SVP / MEP. */
const SET_ALIAS: Record<string, string> = { 'PR-SV': 'SVP', 'PR-ME': 'MEP' }
export const setCode = (set: string) => SET_ALIAS[set] ?? set

export const cardKey = (set: string, no: string) => `${setCode(set)}-${no.replace(/^0+(?=\d)/, '')}`

/** 'Basic {P} Energy' (TCG Live) <-> 'Basic Psychic Energy' (card data) */
const fromLive = (name: string) => name.replace(/^Basic \{(\w)\} Energy$/, (m, s) => (ENERGY_SYMBOL[s] ? `Basic ${ENERGY_SYMBOL[s]} Energy` : m))
const toLive = (name: string) => name.replace(/^Basic (\w+) Energy$/, (m, s) => (SYMBOL[s] ? `Basic {${SYMBOL[s]}} Energy` : m))

/** Parse a TCG Live (or Limitless) export. Lines look like '4 Dreepy TWM 128' under 'Pokémon: 20' headers. */
export function parseDecklist(text: string, index?: Map<string, Card>): Entry[] {
  const out: Entry[] = []
  let section: Card['t'] | null = null
  for (const raw of text.split(/\r?\n/)) {
    const ln = raw.trim()
    const h = ln.match(/^(Pok[ée]mon|Trainer|Energy)\s*[:(]/i)
    if (h) { section = SECTION[h[1].toLowerCase()]; continue }
    const m = ln.match(/^(\d+)\s+(.+?)\s+([A-Z0-9-]{2,6})\s+(\d+[a-z]?)$/) ?? ln.match(/^(\d+)\s+(.+)$/)
    if (!m) continue
    const [count, name, set = '', no = ''] = [Number(m[1]), fromLive(m[2].trim()), m[3] ?? '', m[4] ?? '']
    const card = index && lookup(index, { name, set, no })
    // the card data's spelling wins ('Poke Pad' and 'Poké Pad' are the same card)
    const exact = set && index?.get(cardKey(set, no))
    const nm = exact ? exact.n : name
    const prev = out.find((e) => e.name === nm && e.set === set && e.no === no)
    if (prev) prev.count += count
    else out.push({ count, name: nm, set, no, t: card?.t ?? section })
  }
  return out
}

/** The card data for an entry: its exact printing, or failing that any printing with the same name (older sets aren't indexed). */
export function lookup(index: Map<string, Card>, e: { name: string; set: string; no: string }): Card | undefined {
  const hit = index.get(cardKey(e.set, e.no))
  if (hit) return hit
  for (const c of index.values()) if (c.n === e.name) return c
}

/** For lists written without set codes: the newest set's regular (lowest-numbered) printing of each card. */
export function resolvePrintings(entries: Entry[], cards: Card[]): Entry[] {
  const best = new Map<string, Card>()
  for (const c of cards) {   // cards.json runs oldest set to newest
    const b = best.get(c.n)
    if (!b || b.s !== c.s || parseInt(c.no) < parseInt(b.no)) best.set(c.n, c)
  }
  return entries.map((e) => {
    if (e.set) return e
    const c = best.get(e.name)
    return c ? { ...e, set: c.s, no: c.no, t: e.t ?? c.t } : e
  })
}

/** Promo and energy sets Limitless has images for, beyond the sets in the card data. */
const EXTRA_IMAGE_SETS = ['SVP', 'MEP', 'SVE', 'MEE']
/** Special printings TCG Live gives their own codes; drawn as the card they are a version of. */
const PRINTING_ALIAS: Record<string, { set: string; no: string }> = {
  'MEALT 2': { set: 'MEP', no: '10' },   // Pokémon Center stamped Riolu
}
const knownSets = new WeakMap<Card[], Set<string>>()

/**
 * The printing to show a card as. TCG Live sometimes writes set codes Limitless has no images for
 * (e.g. 'Riolu MEALT 2'); those are drawn as the card's regular printing instead.
 */
export function displayPrinting<T extends { name: string; set: string; no: string }>(e: T, cards: Card[]): T {
  const known = PRINTING_ALIAS[`${e.set} ${e.no.replace(/^0+(?=\d)/, '')}`]
  if (known) return { ...e, ...known }
  if (!cards.length || !e.set) return e
  let sets = knownSets.get(cards)
  if (!sets) knownSets.set(cards, (sets = new Set([...cards.map((c) => c.s), ...EXTRA_IMAGE_SETS])))
  if (sets.has(setCode(e.set))) return e
  const [alt] = resolvePrintings([{ count: 1, name: e.name, set: '', no: '', t: null }], cards)
  return alt.set ? { ...e, set: alt.set, no: alt.no } : e
}

const ORDER: Record<string, number> = { P: 0, T: 1, E: 2 }
const TRAINER_ORDER = ['Supporter', 'Item', 'Pokémon Tool', 'Stadium']

/** Pokémon, then Trainers (Supporters, Items, Tools, Stadiums), then Energy; keeps the list's own order within a group. */
export function sortEntries(entries: Entry[], index: Map<string, Card>): Entry[] {
  const rank = (e: Entry) => {
    const sub = lookup(index, e)?.st ?? ''
    const tr = TRAINER_ORDER.findIndex((x) => sub.includes(x))
    return (ORDER[e.t ?? 'T'] ?? 1) * 10 + (e.t === 'T' ? (tr < 0 ? 4 : tr) : 0)
  }
  return entries.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map((x) => x.e)
}

export function formatDecklist(entries: Entry[]): string {
  const groups: [string, Card['t']][] = [['Pokémon', 'P'], ['Trainer', 'T'], ['Energy', 'E']]
  return groups.map(([label, t]) => {
    const es = entries.filter((e) => (e.t ?? 'T') === t)
    if (!es.length) return ''
    const total = es.reduce((s, e) => s + e.count, 0)
    return `${label}: ${total}\n` + es.map((e) => `${e.count} ${toLive(e.name)}${e.set ? ` ${e.set} ${e.no}` : ''}`).join('\n')
  }).filter(Boolean).join('\n\n') + '\n'
}

export const total = (entries: Entry[]) => entries.reduce((s, e) => s + e.count, 0)

export function cardImage(set: string, no: string, size: 'XS' | 'SM' | 'LG' = 'SM'): string | null {
  const n = no.match(/^(\d+)([a-z]?)$/)
  if (!set || !n) return null
  set = setCode(set)
  return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${set}/${set}_${n[1].padStart(3, '0')}${n[2]}_R_EN_${size}.png`
}

/** Basic Pokémon in a list: what mulligan odds depend on. */
export const basics = (entries: Entry[], index: Map<string, Card>) =>
  entries.filter((e) => e.t === 'P' && /\bBasic\b/.test(lookup(index, e)?.st ?? '')).reduce((s, e) => s + e.count, 0)

export interface Change { name: string; from: number; to: number }

/** Card names compared loosely: case, accents and apostrophe styles don't matter. */
const looseName = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").toLowerCase().trim()

/** What changed between two lists, by card name: a different printing of the same card is not a change. */
export function diffEntries(before: Entry[], after: Entry[]): Change[] {
  const names = new Map<string, string>()
  const sum = (es: Entry[]) => {
    const m = new Map<string, number>()
    for (const e of es) {
      const k = looseName(e.name)
      names.set(k, e.name)   // the later list's spelling is shown
      m.set(k, (m.get(k) ?? 0) + e.count)
    }
    return m
  }
  const a = sum(before), b = sum(after)
  const out: Change[] = []
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const [from, to] = [a.get(k) ?? 0, b.get(k) ?? 0]
    if (from !== to) out.push({ name: names.get(k)!, from, to })
  }
  return out.sort((x, y) => (y.to - y.from) - (x.to - x.from) || x.name.localeCompare(y.name))
}
