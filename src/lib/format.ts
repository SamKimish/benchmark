/** 'dragapult,dusknoir' -> 'Dragapult / Dusknoir', 'starmie-mega' -> 'Mega Starmie'. */
export function prettyArch(slug: string | null | undefined): string {
  if (!slug) return 'Unknown'
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
