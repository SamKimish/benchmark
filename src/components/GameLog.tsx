'use client'
import { useEffect, useState } from 'react'
import type { CardInfo } from '@/lib/cardinfo'
import { isKeyEvent, type LogEvent, type Timeline } from '@/lib/parser/timeline'
import Mon from './Mon'

const ENERGY: Record<string, string> = {
  Grass: '#4caf50', Fire: '#e8532f', Water: '#3d8fe0', Lightning: '#f2c12e', Psychic: '#9c5bd1',
  Fighting: '#b8692f', Darkness: '#3b4252', Metal: '#8c97a6', Dragon: '#b8962e', Colorless: '#d9d9d9',
}

/** A card by name, with its picture on hover when we have one. */
function CardChip({ name, cards }: { name: string; cards: Record<string, CardInfo> }) {
  const c = cards[name]
  const energy = name.match(/^Basic (\w+) Energy$/)?.[1]
  if (energy) return <span className="card-chip energy"><i style={{ background: ENERGY[energy] ?? 'var(--muted)' }} />{energy}</span>
  if (c?.t === 'P') return <span className="card-chip mon-chip"><Mon name={name} small />{name}</span>
  const kind = c?.st.startsWith('Supporter') ? 'supporter' : c?.st.startsWith('Stadium') ? 'stadium' : c?.t === 'E' ? 'energy' : c?.st.startsWith('Pokémon Tool') ? 'tool' : 'item'
  return (
    <span className={`card-chip ${kind}`} tabIndex={c?.img ? 0 : undefined}>
      {name}
      {c?.img && <span className="card-pop"><img src={c.img} alt={name} loading="lazy" /></span>}
    </span>
  )
}

const whose = (e: LogEvent) => (e.who === 'me' ? 'Your' : 'Their')

function Row({ e, cards }: { e: LogEvent; cards: Record<string, CardInfo> }) {
  const chip = (n?: string) => (n ? <CardChip name={n} cards={cards} /> : null)
  let body: React.ReactNode
  switch (e.kind) {
    case 'attack':
      body = <><Mon name={e.mon!} /><span><strong>{e.mon}</strong> used <strong>{e.card}</strong> on <Mon name={e.target!} small />{e.target}</span>
        <span className="dmg">{e.damage}</span></>
      break
    case 'ability':
      body = <><Mon name={e.mon!} small /><span>{e.mon} used <em>{e.card}</em></span></>
      break
    case 'ko':
      body = <><Mon name={e.mon!} /><span><strong>{whose(e)} {e.mon}</strong> was Knocked Out</span></>
      break
    case 'prize':
      body = <><span className="prize-card" aria-hidden /><span>{e.who === 'me' ? 'You' : 'They'} took {e.n === 1 ? 'a Prize card' : `${e.n} Prize cards`}</span>
        {e.score && <span className="score-chip">{e.score[0]}–{e.score[1]}</span>}</>
      break
    case 'evolve':
      body = <><Mon name={e.target!} small /><span className="arrow">→</span><Mon name={e.mon!} /><span>Evolved {e.target} into <strong>{e.mon}</strong></span></>
      break
    case 'bench': case 'active':
      body = <><Mon name={e.mon!} small /><span>{e.mon} to the {e.kind === 'bench' ? 'Bench' : 'Active Spot'}</span></>
      break
    case 'switch':
      body = <><Mon name={e.mon!} small /><span>{whose(e)} {e.mon} is now Active</span></>
      break
    case 'retreat':
      body = <><Mon name={e.mon!} small /><span>Retreated {e.mon}</span></>
      break
    case 'trainer': case 'stadium':
      body = <span>{chip(e.card)}</span>
      break
    case 'attach':
      body = <span>{chip(e.card)} <span className="arrow">→</span> {e.target}</span>
      break
    default:
      body = <span>{e.text}</span>
  }
  const tone = e.kind === 'ko' ? (e.who === 'me' ? ' bad' : ' good') : e.kind === 'prize' ? (e.who === 'me' ? ' good' : ' bad') : ''
  return (
    <li className={`ev ${e.kind}${tone}`}>
      <div className="ev-main">{body}</div>
      {(e.details.length > 0 || e.cards.length > 0) && (
        <div className="ev-more">
          {e.details.map((d, i) => <div key={i}>{d}</div>)}
          {e.cards.length > 0 && <div className="ev-cards">{e.cards.map((c, i) => <CardChip key={i} name={c} cards={cards} />)}</div>}
        </div>
      )}
    </li>
  )
}

/**
 * The game log as a timeline: one block per turn with sprites and cards, Knockouts and prizes picked
 * out, and a "Key moments" view that keeps just the attacks, KOs, prizes, evolutions and Supporters.
 */
export default function GameLog({ tl, cards, raw }: { tl: Timeline; cards: Record<string, CardInfo>; raw: string }) {
  const [all, setAll] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => { try { setAll(localStorage.getItem('log-view') === 'all') } catch { /* no storage */ } }, [])
  const view = (v: boolean) => { setAll(v); try { localStorage.setItem('log-view', v ? 'all' : 'key') } catch { /* no storage */ } }
  const supporters = new Set(Object.entries(cards).filter(([, c]) => c.st.startsWith('Supporter')).map(([n]) => n))
  const shown = (es: LogEvent[]) => (all ? es : es.filter((e) => isKeyEvent(e, supporters)))
  const opp = tl.opp ?? 'Opponent'

  return (
    <section className="game-log">
      <div className="log-head">
        <h2>Game log</h2>
        <div className="seg" role="group" aria-label="How much of the log to show">
          <button type="button" className={!all ? 'on' : ''} onClick={() => view(false)}>Key moments</button>
          <button type="button" className={all ? 'on' : ''} onClick={() => view(true)}>Everything</button>
        </div>
        <button type="button" className="secondary small-btn" onClick={() => navigator.clipboard.writeText(raw).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}>
          {copied ? 'Copied' : 'Copy raw log'}
        </button>
      </div>

      <ol className="turns">
        <li className="turn setup">
          <div className="turn-head"><span className="turn-n">Setup</span></div>
          <ul className="evs">
            {tl.setup.filter((e) => e.kind !== 'hand').map((e, i) => <Row key={i} e={e} cards={cards} />)}
          </ul>
        </li>
        {tl.turns.map((t, i) => {
          const es = shown(t.events)
          return (
            <li key={i} className={`turn ${t.who}`}>
              <div className="turn-head">
                <span className="turn-n">Turn {i + 1}</span>
                <span className="turn-who">{t.who === 'me' ? 'You' : opp}</span>
                <span className="score-chip" title="Prizes taken: you–them">{t.score[0]}–{t.score[1]}</span>
              </div>
              {es.length ? <ul className="evs">{es.map((e, j) => <Row key={j} e={e} cards={cards} />)}</ul>
                : <p className="muted small turn-quiet">{t.events.length ? 'Set up, no attacks.' : 'Nothing played.'}</p>}
            </li>
          )
        })}
      </ol>
      <p className="log-end">{tl.end}</p>
      <details className="raw-log">
        <summary>Raw log</summary>
        <pre className="log">{raw}</pre>
      </details>
    </section>
  )
}
