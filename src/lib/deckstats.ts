/** Headline numbers for a deck from the games played with it. */
export interface DeckGame {
  deck_id: string | null
  result: 'W' | 'L' | null
  went_first?: boolean | null
  opp_archetype?: string | null
  played_at?: string
}

export interface Tally { games: number; wins: number; losses: number }

const tally = (xs: DeckGame[]): Tally => ({
  games: xs.length,
  wins: xs.filter((g) => g.result === 'W').length,
  losses: xs.filter((g) => g.result === 'L').length,
})

/** Win rate over finished games (a cut-off log has no result), or null with none. */
export const winRate = (r: Tally) => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : null)

export function deckStats(games: DeckGame[]) {
  const byOpp = new Map<string, DeckGame[]>()
  for (const g of games) if (g.result) byOpp.set(g.opp_archetype ?? '', [...(byOpp.get(g.opp_archetype ?? '') ?? []), g])
  const byDeck = new Map<string, DeckGame[]>()
  for (const g of games) if (g.deck_id) byDeck.set(g.deck_id, [...(byDeck.get(g.deck_id) ?? []), g])
  return {
    all: tally(games),
    first: tally(games.filter((g) => g.went_first === true)),
    second: tally(games.filter((g) => g.went_first === false)),
    lastPlayed: games.reduce<string | null>((a, g) => (g.played_at && (!a || g.played_at > a) ? g.played_at : a), null),
    /** most played opponents first */
    matchups: [...byOpp.entries()].map(([opp, xs]) => ({ opp: opp || null, ...tally(xs) })).sort((a, b) => b.games - a.games),
    byDeck: new Map([...byDeck.entries()].map(([id, xs]) => [id, tally(xs)])),
  }
}
