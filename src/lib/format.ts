import { limitlessArchetype } from './archetypes'
import { baseArchetype, HAMMER, isHammer } from './parser'

/** A deck key's name on Limitless ('dhelmise,banette' -> 'Dhelmise'), else spelled out:
 * 'dragapult,dusknoir' -> 'Dragapult / Dusknoir', 'starmie-mega' -> 'Mega Starmie'. With Crushing Hammer in
 * it, the hammer version: 'dragapult,crushing-hammer' -> 'Hammer Pult', else 'Gardevoir Hammers'. */
export function prettyArch(slug: string | null | undefined): string {
  if (!slug) return 'Unknown'
  if (slug === HAMMER) return 'Crushing Hammer'
  if (isHammer(slug)) {
    const base = baseArchetype(slug)
    return base === 'dragapult' ? 'Hammer Pult' : `${prettyArch(base)} Hammers`
  }
  const named = limitlessArchetype(slug)?.name
  if (named) return named
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return slug.split(',').map((s) => {
    const parts = s.split('-')
    if (parts[parts.length - 1] === 'mega') return 'Mega ' + parts.slice(0, -1).map(cap).join(' ')
    return parts.map(cap).join(' ')
  }).join(' / ')
}

export const pct = (w: number, n: number) => (n ? `${Math.round((100 * w) / n)}%` : '–')

export const deckLabel = (d: { name: string; version: string } | null | undefined) =>
  d ? (d.version ? `${d.name} · ${d.version}` : d.name) : 'No deck'

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

const LONDON = 'Europe/London'
/** The UK calendar day a game was played on, as YYYY-MM-DD (sorts and groups). */
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: LONDON })
export const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
/** A day's label in two parts, 'Wed' and '11 Nov' (with the year when it isn't this year). */
export function dayParts(key: string): { weekday: string; date: string } {
  const d = new Date(`${key}T12:00:00Z`)
  const thisYear = key.slice(0, 4) === dayKey(new Date().toISOString()).slice(0, 4)
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }), timeZone: 'UTC' }),
  }
}
export const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LONDON })
