'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cardSlug, HAMMER, isHammer, withHammer } from '@/lib/parser'
import { LIMITLESS, spriteUrl } from '@/lib/archetypes'
import { prettyArch } from '@/lib/format'
import type { Card } from '@/lib/decklist'
import Sprites from './Sprites'

let pokemonPromise: Promise<string[]> | null = null
/** Every Pokémon slug in the card data ('dragapult', 'starmie-mega'), for building a deck by hand. */
const loadPokemon = () => (pokemonPromise ??= fetch('/cards.json')
  .then((r) => r.json() as Promise<Card[]>)
  .then((cs) => [...new Set(cs.filter((c) => c.t === 'P').map((c) => cardSlug(c.n)))].sort().concat(HAMMER)))

type Option = { kind: 'deck'; key: string; name: string } | { kind: 'mon'; key: string; name: string }

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)
const hit = (text: string, ws: string[]) => ws.every((w) => text.includes(w))

/**
 * Choosing a deck archetype: search Limitless's decks by name, or Pokémon by name to put a deck
 * together yourself (up to two, the way Limitless names decks).
 */
export default function DeckPicker({ value, onChange, label }: { value: string; onChange: (key: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)   // picking a second Pokémon for the current deck
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [pokemon, setPokemon] = useState<string[]>([])
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const parts = value ? value.split(',').filter(Boolean) : []

  useEffect(() => { if (open) { loadPokemon().then(setPokemon); input.current?.focus() } }, [open])
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const options = useMemo((): Option[] => {
    const ws = words(q.replace(/-/g, ' '))
    const decks: Option[] = adding ? [] : LIMITLESS
      .filter((a) => !ws.length || hit(`${a.name} ${a.key.replace(/[,-]/g, ' ')}`.toLowerCase(), ws))
      .slice(0, ws.length ? 5 : 12)
      .map((a) => ({ kind: 'deck', key: a.key, name: a.name }))
    // a two-Pokémon deck can still take a hammer; with nothing typed yet, offer the hammer first
    if (adding && (parts.length > 1 || !ws.length)) return [{ kind: 'mon', key: HAMMER, name: prettyArch(HAMMER) }]
    const mons: Option[] = !ws.length ? [] : pokemon
      .filter((p) => hit(p.replace(/-/g, ' '), ws))
      .sort((a, b) => Number(!a.startsWith(ws[0])) - Number(!b.startsWith(ws[0])) || a.length - b.length)
      .slice(0, 8)
      .map((p) => ({ kind: 'mon', key: p, name: prettyArch(p) }))
    return [...decks, ...mons]
  }, [q, pokemon, adding, parts.length])

  useEffect(() => setActive(0), [q, adding])

  function close() { setOpen(false); setAdding(false); setQ('') }
  function choose(o: Option) {
    if (o.kind === 'mon' && adding && o.key === HAMMER) onChange(withHammer(value))
    else if (o.kind === 'mon' && adding && parts.length === 1 && parts[0] !== o.key) onChange(`${parts[0]},${o.key}`)
    else onChange(o.key)
    close()
  }

  return (
    <div className="picker" ref={box}>
      <span className="picker-label">{label}</span>
      <div className="picker-value">
        <button type="button" className="picker-current" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
          <Sprites arch={value} />
          <span><strong>{value ? prettyArch(value) : 'Pick a deck'}</strong>
            {value && parts.map(prettyArch).join(' + ') !== prettyArch(value) && <span className="muted small"> · {parts.map(prettyArch).join(' + ')}</span>}</span>
          <span className="muted small picker-change">Change</span>
        </button>
        {value && !isHammer(value) && parts.length <= 2 && (
          <button type="button" className="secondary picker-add" onClick={() => { setAdding(true); setOpen(true) }} title="Add a second Pokémon, or Crushing Hammer for the Hammer version">+ Add</button>
        )}
      </div>
      {open && (
        <div className="picker-pop panel" onKeyDown={(e) => {
          e.stopPropagation()   // keep Enter and Esc from reaching the dialog around us
          if (e.key === 'Escape') close()
          else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter' && options[active]) { e.preventDefault(); choose(options[active]) }
        }}>
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={adding ? `Add a Pokémon or Crushing Hammer to ${prettyArch(value)}…` : 'Search decks or Pokémon: dhelmise, gardevoir…'} />
          <ul role="listbox">
            {options.map((o, i) => {
              const first = i === 0 || options[i - 1].kind !== o.kind
              return (
                <li key={`${o.kind}-${o.key}`}>
                  {first && <div className="picker-head">{o.kind === 'deck' ? (q ? 'Decks' : 'Most played decks') : 'Pokémon'}</div>}
                  <button type="button" role="option" aria-selected={i === active} className={i === active ? 'on' : ''}
                    onMouseEnter={() => setActive(i)} onClick={() => choose(o)}>
                    {o.kind === 'deck' ? <Sprites arch={o.key} /> : <span className="sprites"><span className="sprite"><img src={spriteUrl(o.key)} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /></span></span>}
                    <span>{o.name}</span>
                  </button>
                </li>
              )
            })}
            {q && !options.length && <li className="muted small picker-empty">{pokemon.length ? 'Nothing matches.' : 'Loading Pokémon…'}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
