import { createHash } from 'node:crypto'
import { gameStats } from './parser'
import { normalize } from './parser/text'

/** Bump when the parser's output changes, so saved games can be analysed again (2: win reasons, Hammer decks). */
export const PARSER_VERSION = 2

export const logHash = (log: string) => createHash('sha256').update(normalize(log).trim()).digest('hex')

/** A games row (minus user_id and overrides) for a raw log. Throws LogError on logs it can't read. */
export function gameRow(log: string, archetype?: string | null) {
  const s = gameStats(log, { archetype })
  return {
    log,
    log_hash: logHash(log),
    me: s.me,
    opponent: s.opponent,
    result: s.result,
    went_first: s.went_first,
    my_archetype: s.my_archetype,
    opp_archetype: s.opp_archetype,
    end_reason: s.end_reason,
    tags: s.tags,
    win_tags: s.win_tags,
    stats: s,
    parser_version: PARSER_VERSION,
  }
}
