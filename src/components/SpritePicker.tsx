'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HAMMER } from '@/lib/parser'
import { deckSprites, LIMITLESS, spriteUrl } from '@/lib/archetypes'
import { prettyArch } from '@/lib/format'
import { loadPokemon } from './DeckPicker'
import Sprites from './Sprites'

type Option = { kind: 'deck'; key: string; name: string; slugs: string[] } | { kind: 'mon'; key: string; name: string; slugs: string[] }

const words = (q: string) => q.toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean)
const hit = (text: string, ws: string[]) => ws.every((w) => text.includes(w))

/**
 * Up to two Pokémon to draw for a deck. Click a slot and search for a Pokémon to put there, or pick
 * one of Limitless's decks to take both of its sprites at once.
 */
export default function SpritePicker({ value, suggested, onChange }: {
  value: string[]
  /** what the deck's archetype would show, offered as a reset */
  suggested: string[]
  onChange: (sprites: string[]) => void
}) {
  const [slot, setSlot] = useState<0 | 1 | null>(null)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [pokemon, setPokemon] = useState<string[]>([])
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const open = slot !== null

  useEffect(() => { if (open) { loadPokemon().then(setPokemon); input.current?.focus() } }, [open])
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])
  useEffect(() => setActive(0), [q, slot])

  const options = useMemo((): Option[] => {
    const ws = words(q)
    const mons: Option[] = !ws.length ? [] : pokemon
      .filter((p) => hit(p.replace(/-/g, ' '), ws))
      .sort((a, b) => Number(!a.startsWith(ws[0])) - Number(!b.startsWith(ws[0])) || a.length - b.length)
      .slice(0, 10)
      .map((p) => ({ kind: 'mon', key: p, name: prettyArch(p), slugs: [p] }))
    // a deck fills both slots, so offer decks from the first slot only
    const decks: Option[] = slot !== 0 ? [] : LIMITLESS
      .filter((a) => !ws.length || hit(`${a.name} ${a.key.replace(/[,-]/g, ' ')}`.toLowerCase(), ws))
      .slice(0, ws.length ? 5 : 10)
      .map((a) => ({ kind: 'deck', key: a.key, name: a.name, slugs: deckSprites(a.key) }))
    return ws.length ? [...mons, ...decks] : decks
  }, [q, pokemon, slot])

  function close() { setSlot(null); setQ('') }
  function choose(o: Option) {
    if (o.kind === 'deck') onChange(o.slugs.slice(0, 2))
    else if (slot === 1) onChange([value[0] ?? o.key, o.key].filter((s, i, xs) => xs.indexOf(s) === i))
    else onChange([o.key, ...value.slice(1)].filter((s, i, xs) => xs.indexOf(s) === i))
    close()
  }

  const isSuggested = value.length === suggested.length && value.every((s, i) => s === suggested[i])

  return (
    <div className="picker sprite-picker" ref={box}>
      <span className="picker-label">Sprites</span>
      <div className="sprite-slots">
        {([0, 1] as const).map((i) => {
          const s = value[i]
          if (i === 1 && !value[0]) return null
          return (
            <span key={i} className="sprite-slot-wrap">
              <button type="button" className={`sprite-slot${slot === i ? ' on' : ''}`} onClick={() => setSlot(slot === i ? null : i)}
                title={s ? `${prettyArch(s)}: click to change` : 'Add a second Pokémon'} aria-label={s ? `Sprite ${i + 1}: ${prettyArch(s)}` : 'Add a sprite'}>
                {s ? <Sprites slugs={[s]} title={prettyArch(s)} /> : <span className="sprite-plus">+</span>}
              </button>
              {s && i === 1 && <button type="button" className="sprite-remove" onClick={() => onChange(value.slice(0, 1))} aria-label="Remove the second sprite" title="Remove">×</button>}
            </span>
          )
        })}
        {!isSuggested && suggested.length > 0 && (
          <button type="button" className="link small" onClick={() => onChange(suggested)} title={`Back to the archetype's sprites: ${suggested.map(prettyArch).join(' and ')}`}>
            Reset
          </button>
        )}
      </div>
      {open && (
        <div className="picker-pop panel" onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') close()
          else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter' && options[active]) { e.preventDefault(); choose(options[active]) }
        }}>
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={slot === 0 ? 'Search Pokémon or decks: dragapult, gardevoir…' : `Second Pokémon next to ${prettyArch(value[0])}…`} />
          <ul role="listbox">
            {options.map((o, i) => {
              const first = i === 0 || options[i - 1].kind !== o.kind
              return (
                <li key={`${o.kind}-${o.key}`}>
                  {first && <div className="picker-head">{o.kind === 'deck' ? (q ? 'Decks (both sprites)' : 'Most played decks (both sprites)') : 'Pokémon'}</div>}
                  <button type="button" role="option" aria-selected={i === active} className={i === active ? 'on' : ''}
                    onMouseEnter={() => setActive(i)} onClick={() => choose(o)}>
                    {o.kind === 'deck' ? <Sprites slugs={o.slugs} />
                      : <span className="sprites"><span className="sprite"><img src={spriteUrl(o.key)} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /></span></span>}
                    <span>{o.key === HAMMER ? 'Crushing Hammer' : o.name}</span>
                  </button>
                </li>
              )
            })}
            {!q && slot === 1 && <li className="muted small picker-empty">Type a Pokémon&apos;s name.</li>}
            {q && !options.length && <li className="muted small picker-empty">{pokemon.length ? 'Nothing matches.' : 'Loading Pokémon…'}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
