/** Rows exported from Training Court's `logs` table, and which Benchmark deck each one belongs to. */
import spec from './training-court-decks.json'

export interface TcLog {
  id: string
  created_at: string
  log: string
  archetype: string
  opp_archetype: string | null
  result: 'W' | 'L' | null
  decklist_id: string | null
}

export interface DeckSpec {
  name: string
  version: string
  version_order: number
  archetype: string
  basics?: number
  active?: boolean
  decklist?: string
  match: [string, string | null][]
}

export const TC_DECKS = spec.decks as DeckSpec[]

/** The deck spec a Training Court row was played with, by its archetype and decklist id. */
export const tcDeckSpec = (l: Pick<TcLog, 'archetype' | 'decklist_id'>) =>
  TC_DECKS.find((d) => d.match.some(([a, id]) => a === l.archetype && id === (l.decklist_id ?? null)))

export function isTcExport(x: unknown): x is TcLog[] {
  return Array.isArray(x) && x.every((r) => r && typeof r.log === 'string' && typeof r.created_at === 'string')
}
