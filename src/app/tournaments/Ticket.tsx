import type { CSSProperties, ReactNode } from 'react'
import { prettyArch } from '@/lib/format'
import { kindLabel, matchResult, ordinal, recordText, startsDay2, type MatchRecord, type Round } from '@/lib/tournaments'
import Sprites from '@/components/Sprites'
import { KindIcon } from './KindIcon'

const RESULT = { W: 'Win', L: 'Loss', T: 'Tie' } as const

/** The run as a row of tiles, one per round, with a gap where day two starts. */
export function Ribbon({ rounds }: { rounds: Round[] }) {
  return (
    <ol className="lx-ribbon" aria-label="Rounds">
      {rounds.map((r, i) => {
        const m = matchResult(r)
        const day2 = startsDay2(rounds, i)
        const res = r.special === 'bye' ? 'Bye' : r.special === 'id' ? 'Intentional draw' : m ? RESULT[m] : 'No result yet'
        const vs = r.special === 'bye' ? '' : [r.opponent && `vs ${r.opponent}`, r.opp && `(${prettyArch(r.opp)})`].filter(Boolean).join(' ')
        const games = !r.special && r.games.length > 1 ? `, ${r.games}` : ''
        return (
          <li key={i} className={`lx-tile ${m ?? ''}${day2 ? ' day2' : ''}`} style={{ '--i': i } as CSSProperties}
            title={`Round ${i + 1}: ${res}${games}${vs ? ` ${vs}` : ''}`}>
            {day2 && <span className="lx-day2" />}
            <span className="lx-tile-r">{r.special === 'bye' ? 'B' : r.special === 'id' ? 'ID' : m ?? '–'}</span>
            <span className="lx-tile-n">{i + 1}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * A tournament as a ticket stub: the event on the left with a tile per round, and a tear-off stub
 * on the right with where you finished, your record and your deck.
 */
export default function Ticket({ kind, eyebrow, name, meta, rounds, rec, placement, players, cp, arch, slugs, deck, badge, children, style, className = '' }: {
  kind: string
  eyebrow?: ReactNode
  name: string
  meta: ReactNode[]
  rounds: Round[]
  rec: MatchRecord
  placement: number | null
  players: number | null
  /** Championship Points earned there */
  cp?: number | null
  arch: string | null
  slugs?: string[]
  /** the deck's name under the sprites */
  deck?: ReactNode
  badge?: ReactNode
  children?: ReactNode
  style?: CSSProperties
  className?: string
}) {
  const tone = rounds.length || rec.w + rec.l + rec.t ? (rec.w > rec.l ? 'W' : rec.l > rec.w ? 'L' : 'T') : ''
  const suffix = placement ? ordinal(placement).slice(String(placement).length) : ''
  return (
    <article className={`lx-ticket ${tone} ${className}`} style={style}>
      <div className="lx-main">
        <div className="lx-eyebrow"><KindIcon kind={kind} size={15} /> {kindLabel(kind)}{eyebrow}</div>
        <h2 className="lx-name">{name}</h2>
        <div className="lx-meta">{meta.filter(Boolean).map((m, i) => <span key={i}>{m}</span>)}</div>
        {rounds.length > 0 ? <Ribbon rounds={rounds} /> : <p className="muted small lx-empty">No rounds logged yet.</p>}
        {children}
      </div>
      <div className="lx-stub">
        <div className="lx-place">
          <span className="lx-place-n">{placement ?? '–'}</span>{suffix && <span className="lx-place-s">{suffix}</span>}
        </div>
        {players ? <div className="lx-of">of {players.toLocaleString('en-GB')}</div> : <div className="lx-of">{placement ? 'place' : 'no finish'}</div>}
        <div className="lx-rec" title="Wins-losses-ties">{recordText(rec)}</div>
        {cp ? <div className="lx-cp" title="Championship Points">+{cp} CP</div> : null}
        <Sprites arch={arch} slugs={slugs} />
        {deck && <div className="lx-stub-deck">{deck}</div>}
        {badge}
      </div>
    </article>
  )
}
