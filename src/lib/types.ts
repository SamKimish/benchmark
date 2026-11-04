import type { GameStats } from './parser'

export interface Deck {
  id: string
  /** versions of the same list share this */
  line_id: string
  name: string
  version: string
  version_order: number
  archetype: string | null
  decklist: string
  basics: number | null
  active: boolean
  /** up to two Pokémon slugs drawn for this deck; empty = its archetype's */
  sprites: string[]
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
  /** the sprites shown for your side of this game; empty = the deck's */
  my_sprites: string[]
  opp_archetype: string | null
  end_reason: string | null
  tags: string[]
  win_tags: string[]
  stats: GameStats
  source: string
  notes: string
}
