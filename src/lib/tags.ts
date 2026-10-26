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
