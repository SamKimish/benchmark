/** Helpers shared by the log parser. */

export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Line endings to \n, and fill in the "[playerName]'s Turn" headers some TCG Live exports have. */
export function normalize(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "[playerName]'s Turn") {
      const nxt = lines.slice(i + 1).find((l) => l.trim()) ?? ''
      const m = nxt.match(/^(\S+?)(?:'s)? /)
      if (m) lines[i] = `${m[1]}'s Turn`
    }
  }
  return lines.join('\n')
}

export const splitCards = (s: string) => s.split(',').map((c) => c.trim()).filter(Boolean)

/** The player who exported the log: TCG Live only lists the exporter's own opening hand. */
export function detectMe(text: string): string | null {
  const lines = text.split('\n')
  let me: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\S+) drew 7 cards for the opening hand/)
    if (!m) continue
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      if (lines[j].trim().startsWith('•')) me = m[1]
      if (/^\S+ drew 7 cards/.test(lines[j])) break
    }
  }
  return me
}

const REGIONS: Record<string, string> = { Alolan: 'alola', Galarian: 'galar', Hisuian: 'hisui', Paldean: 'paldea' }

/**
 * Limitless-style slug for a Pokémon name: 'Meowth ex' -> 'meowth', 'Mega Starmie ex' -> 'starmie-mega',
 * "Team Rocket's Spidops" -> 'spidops', 'Hisuian Zoroark' -> 'zoroark-hisui', 'Wellspring Mask Ogerpon ex' -> 'ogerpon-wellspring'.
 */
export function cardSlug(name: string | null | undefined): string {
  let n = (name ?? '').replace(/^(?:Team Rocket's|\S+'s) /, '')
  n = n.replace(/ ex$| V$| VSTAR$/, '')
  let suffix = ''
  const mega = n.startsWith('Mega ')
  if (mega) { n = n.slice(5); suffix = '-mega' }
  const region = n.match(/^(\w+) /)
  if (region && REGIONS[region[1]]) { n = n.slice(region[0].length); suffix += '-' + REGIONS[region[1]] }
  const mask = n.match(/^(\w+) Mask (Ogerpon)$/)
  if (mask) { n = mask[2]; if (mask[1] !== 'Teal') suffix += '-' + mask[1].toLowerCase() }
  n = n.toLowerCase().replace(/é/g, 'e').replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-')
  return n + suffix
}
