import type { GameStats } from './parser'

export interface Deck {
  id: string
  name: string
  version: string
  version_order: number
  archetype: string | null
  decklist: string
  basics: number | null
  active: boolean
  created_at: string
}

export interface Game {
  id: string
  deck_id: string | null
  played_at: string
  log: string
  me: string
  opponent: string | null
  result: 'W' | 'L' | null
  went_first: boolean | null
  my_archetype: string | null
  opp_archetype: string | null
  end_reason: string | null
  tags: string[]
  stats: GameStats
  source: string
  notes: string
}
