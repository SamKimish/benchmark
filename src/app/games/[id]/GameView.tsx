import Link from 'next/link'
import { prettyArch, shortDate } from '@/lib/format'
import { cardInfo } from '@/lib/cardinfo'
import { knockouts, timeline } from '@/lib/parser/timeline'
import type { Deck, Game } from '@/lib/types'
import Sprites from '@/components/Sprites'
import Mon from '@/components/Mon'
import GameLog from '@/components/GameLog'
import GameNotes from '@/components/GameNotes'
import Icon from '@/components/Icon'
import { MatchEditor, RowActions } from '@/components/MatchEditor'
import type { KnownTags } from '@/components/GameDialog'

/** A headline number for one game. `tone` colours it when it's clearly good or bad for you. */
function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`panel stat game-stat${tone ? ` ${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-n">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

/** The game page itself, given everything it shows. */
export default function GameView({ game, decks, knownTags }: { game: Game; decks: Deck[]; knownTags: KnownTags }) {
  const s = game.stats
  const deck = (decks).find((d) => d.id === game.deck_id)
  const myArch = deck?.archetype ?? game.my_archetype
  const tl = timeline(game.log)
  const kos = knockouts(tl)

  // every card the log names, so the timeline can show pictures and tell Supporters from Items
  const names = new Set<string>(s.opening_hand)
  for (const e of [...tl.setup, ...tl.turns.flatMap((t) => t.events)]) {
    if (e.card) names.add(e.card)
    e.cards.forEach((c) => names.add(c))
  }
  const cards = cardInfo(names, deck?.decklist)
  const result = game.result === 'W' ? 'Win' : game.result === 'L' ? 'Loss' : 'Unfinished'
  const online = s.first_attacker_turn
  const editRow = {
    id: game.id, deck_id: game.deck_id, opp_archetype: game.opp_archetype, result: game.result, tags: game.tags, win_tags: game.win_tags,
    went_first: game.went_first, opponent: game.opponent, prizes_taken: s.prizes_taken, prizes_given: s.prizes_given,
  }

  return (
    <MatchEditor decks={decks} knownTags={knownTags} afterDelete="/">
      <Link href="/" className="button secondary back-link"><Icon name="back" /> Match log</Link>

      <div className={`game-hero ${game.result ?? 'none'}`}>
        <div className="hero-side">
          <Sprites arch={myArch} />
          <span className="hero-deck">{deck ? <>{deck.name}<span className="ver">{deck.version}</span></> : prettyArch(myArch)}</span>
        </div>
        <div className="hero-mid">
          <div className="hero-result">{result}</div>
          <div className="hero-score">{s.prizes_taken}<span>–</span>{s.prizes_given}</div>
          <div className="hero-meta">
            {shortDate(game.played_at)} · went {s.went_first ? '1st' : '2nd'} · {s.end_reason}
          </div>
        </div>
        <div className="hero-side opp">
          <Sprites arch={game.opp_archetype} />
          <span className="hero-deck">{prettyArch(game.opp_archetype)}<span className="ver">{game.opponent ?? 'Unknown player'}</span></span>
        </div>
        <RowActions row={editRow} />
      </div>

      {(game.win_tags.length > 0 || game.tags.length > 0) && (
        <div className="hero-tags">
          {game.win_tags.map((t) => <span key={`w-${t}`} className="pill good">{t}</span>)}
          {game.tags.map((t) => <span key={`l-${t}`} className="pill bad">{t}</span>)}
        </div>
      )}

      <div className="tiles game-tiles">
        <Tile label="First prize" value={s.first_prize === 'Me' ? 'You' : s.first_prize === 'Opponent' ? 'Them' : '–'}
          tone={s.first_prize === 'Me' ? 'good' : s.first_prize === 'Opponent' ? 'bad' : undefined}
          sub={s.first_taken_prizes || s.first_given_prizes ? `${s.first_prize === 'Me' ? s.first_taken_prizes : s.first_given_prizes}-prize KO` : undefined} />
        <Tile label="Attacker online" value={online ? `Turn ${online}` : 'Never'} sub="your turn count"
          tone={online !== null && online <= 2 ? 'good' : online === null || online > 3 ? 'bad' : undefined} />
        <Tile label="Turns" value={`${s.my_turns} · ${s.opp_turns}`} sub="yours · theirs" />
        <Tile label="Mulligans" value={`${s.mulligans} · ${s.opp_mulligans}`} sub="yours · theirs" tone={s.mulligans ? 'bad' : s.opp_mulligans ? 'good' : undefined} />
        {s.hammers_played > 0 && (
          <Tile label="Crushing Hammer" value={`${s.hammer_heads}/${s.hammers_played}`} sub="heads"
            tone={s.hammer_heads / s.hammers_played >= 0.5 ? 'good' : 'bad'} />
        )}
        {s.dive_placements > 0 && <Tile label="Phantom Dive" value={`${s.dive_converted}/${s.dive_placements}`} sub="spreads turned into KOs" />}
      </div>

      <div className="game-body">
        <GameLog tl={tl} cards={cards} raw={game.log} />

        <aside className="game-side">
          <div className="panel">
            <h3>Opening hand</h3>
            <div className="hand">
              {s.opening_hand.map((n, i) => {
                const img = cards[n]?.img
                return (
                  <figure key={i} className={n === s.opening_active ? 'active' : ''} title={n}>
                    {img ? <img src={img} alt={n} loading="lazy" /> : <span className="hand-name">{n}</span>}
                    {n === s.opening_active && <figcaption>Active</figcaption>}
                  </figure>
                )
              })}
            </div>
            {!s.opening_hand.length && <p className="muted small">Not in the log.</p>}
          </div>

          <div className="panel">
            <h3>Knockouts</h3>
            {kos.length ? (
              <ol className="kos">
                {kos.map((k, i) => (
                  <li key={i} className={k.who === 'me' ? 'bad' : 'good'}>
                    <span className="muted small ko-turn">T{k.turn}</span>
                    <Mon name={k.mon} />
                    <span className="ko-name">{k.who === 'me' ? 'Your' : 'Their'} {k.mon}</span>
                    {k.score && <span className="score-chip">{k.score[0]}–{k.score[1]}</span>}
                  </li>
                ))}
              </ol>
            ) : <p className="muted small">No Pokémon were Knocked Out.</p>}
          </div>

          <div className="panel">
            <h3>Their Pokémon</h3>
            <div className="their-mons">
              {s.opp_pokemon.map((m) => <span key={m} className="card-chip mon-chip"><Mon name={m} small />{m}</span>)}
            </div>
          </div>

          <div className="panel">
            <h3>Notes</h3>
            <GameNotes id={game.id} initial={game.notes ?? ''} />
          </div>
        </aside>
      </div>
    </MatchEditor>
  )
}
