/** The loss reasons the log parser can tag a game with; users can add their own on top. */
export const LOSS_TAGS = [
  'Mulligan', 'Slow start', "Line KO'd early", "Support ex KO'd", 'Gave up first KO on ex', 'Item locked',
  'Energy denied', 'Hand disrupted', 'Missed attacks', 'Decked out', 'Early concede', 'Outpaced',
]

/** And the win reasons, the other side of the same coin. */
export const WIN_TAGS = [
  'Fast setup', 'Budew open', 'Opp mulligan', 'Took first KO on ex', "KO'd their support ex", 'Item locked them',
  'Hammers hit', 'Energy denied them', 'Disrupted their hand', 'Opp decked out', 'Opp early concede', 'Outpaced them',
]

/** Reasons to offer when tagging a game: the built-in ones plus any custom ones, most used first. */
export function knownTagsFrom(rows: { tags: string[]; win_tags: string[] }[]) {
  const byUse = (base: string[], pick: (r: { tags: string[]; win_tags: string[] }) => string[]) => {
    const use = new Map(base.map((t) => [t, 0]))
    for (const r of rows) for (const t of pick(r)) use.set(t, (use.get(t) ?? 0) + 1)
    return [...use.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }
  return { loss: byUse(LOSS_TAGS, (r) => r.tags), win: byUse(WIN_TAGS, (r) => r.win_tags) }
}
