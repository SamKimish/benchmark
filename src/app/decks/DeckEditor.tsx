'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { basics, cardImage, cardKey, formatDecklist, lookup, parseDecklist, resolvePrintings, sortEntries, total, type Card, type Entry } from '@/lib/decklist'
import { detectArchetype } from '@/lib/parser'
import { prettyArch } from '@/lib/format'
import type { Deck } from '@/lib/types'
import { saveDeck } from './actions'

let cardsPromise: Promise<Card[]> | null = null
const loadCards = () => (cardsPromise ??= fetch('/cards.json').then((r) => r.json() as Promise<Card[]>))

const same = (a: Entry, b: { set: string; no: string; name: string }) => a.set === b.set && a.no === b.no && a.name === b.name

function CardImg({ e, size = 'SM' }: { e: { name: string; set: string; no: string }; size?: 'SM' | 'LG' }) {
  const [broken, setBroken] = useState(false)
  const src = cardImage(e.set, e.no, size)
  if (!src || broken) return <div className="noimg card-img">{e.name}<span className="muted small">{e.set} {e.no}</span></div>
  return <img className="card-img" src={src} alt={`${e.name} ${e.set} ${e.no}`} loading="lazy" onError={() => setBroken(true)} />
}

export default function DeckEditor({ deck }: { deck?: Deck }) {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>([])
  const index = useMemo(() => new Map(cards.map((c) => [cardKey(c.s, c.no), c])), [cards])
  const [entries, setEntries] = useState<Entry[]>(() => parseDecklist(deck?.decklist ?? ''))
  const [name, setName] = useState(deck?.name ?? '')
  const [version, setVersion] = useState(deck?.version ?? '')
  const [order, setOrder] = useState(deck?.version_order ?? 1)
  const [archetype, setArchetype] = useState(deck?.archetype ?? '')
  const [active, setActive] = useState(deck?.active ?? true)
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(!deck)
  const [importText, setImportText] = useState('')
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadCards().then((cs) => {
      setCards(cs)
      // fill in card types the saved text didn't carry
      const idx = new Map(cs.map((c) => [cardKey(c.s, c.no), c]))
      setEntries((es) => resolvePrintings(es, cs).map((e) => ({ ...e, t: lookup(idx, e)?.t ?? e.t })))
    })
  }, [])

  const sorted = useMemo(() => sortEntries(entries, index), [entries, index])
  const count = total(entries)
  const suggested = useMemo(() => detectArchetype(entries.filter((e) => e.t === 'P').map((e) => e.name)), [entries])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const words = q.split(/\s+/)
    const out: Card[] = []
    for (let i = cards.length - 1; i >= 0 && out.length < 60; i--) {
      const c = cards[i]
      const hay = `${c.n} ${c.s} ${c.no}`.toLowerCase()
      if (words.every((w) => hay.includes(w))) out.push(c)
    }
    return out
  }, [query, cards])

  const change = (e: { name: string; set: string; no: string; t: Entry['t'] }, by: number) => {
    setStatus({})
    setEntries((es) => {
      const hit = es.find((x) => same(x, e))
      if (!hit) return by > 0 ? [...es, { name: e.name, set: e.set, no: e.no, t: e.t, count: by }] : es
      return es.map((x) => (x === hit ? { ...x, count: x.count + by } : x)).filter((x) => x.count > 0)
    })
  }

  async function save() {
    setBusy(true)
    const res = await saveDeck({
      id: deck?.id, name: name.trim(), version: version.trim(), version_order: order,
      archetype: archetype.trim() || suggested, decklist: formatDecklist(sorted),
      basics: cards.length ? basics(entries, index) : deck?.basics ?? null, active,
    })
    setBusy(false)
    if (res.error) return setStatus({ error: res.error })
    if (!archetype.trim() && suggested) setArchetype(suggested)
    setStatus({ ok: 'Saved' })
    if (!deck && res.id) router.replace(`/decks/${res.id}`)
    else router.refresh()
  }

  async function exportList() {
    const text = formatDecklist(sorted)
    try {
      await navigator.clipboard.writeText(text)
      setStatus({ ok: 'Copied for TCG Live' })
    } catch {
      setImportText(text)
      setImporting(true)
    }
  }

  return (
    <div className="builder">
      <section className="panel builder-deck">
        <div className="row">
          <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Deck name" aria-label="Deck name" />
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version" aria-label="Version" size={7} />
          <button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="secondary" onClick={() => setImporting((x) => !x)}>Import</button>
          <button className="secondary" onClick={exportList} disabled={!count}>Export</button>
          <button className="secondary" onClick={() => { if (confirm('Remove every card?')) setEntries([]) }} disabled={!count}>Clear</button>
        </div>
        <div className="row small muted" style={{ marginTop: 10, alignItems: 'center' }}>
          <span className={count === 60 ? '' : 'error'}>Cards: {count}/60</span>
          {cards.length > 0 && <span>Basics: {basics(entries, index)}</span>}
          <label className="inline">Archetype
            <input value={archetype} onChange={(e) => setArchetype(e.target.value)} placeholder={suggested ?? 'dragapult'} size={16} title={prettyArch(archetype || suggested)} />
          </label>
          <label className="inline">Order<input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value) || 1)} style={{ width: 60 }} /></label>
          <label className="inline"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Offer on upload</label>
          {status.ok && <span>{status.ok}</span>}
          {status.error && <span className="error">{status.error}</span>}
          <Link href="/decks" style={{ marginLeft: 'auto' }}>All decks</Link>
        </div>

        {importing && (
          <div className="form" style={{ maxWidth: 'none', marginTop: 12 }}>
            <label>Paste a decklist exported from TCG Live or Limitless
              <textarea rows={10} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'Pokémon: 20\n4 Dreepy TWM 128\n…'} />
            </label>
            <div className="row">
              <button disabled={!importText.trim()} onClick={() => {
                const es = resolvePrintings(parseDecklist(importText, index), cards)
                if (!es.length) return setStatus({ error: 'No cards found in that text.' })
                setEntries(es)
                setImportText('')
                setImporting(false)
                setStatus({ ok: `Imported ${total(es)} cards` })
              }}>Replace deck with this list</button>
              <button className="secondary" onClick={() => setImporting(false)}>Cancel</button>
            </div>
          </div>
        )}

        {count === 0 && !importing ? (
          <p className="muted" style={{ marginTop: 24 }}>No cards yet. Search on the right, or import a list.</p>
        ) : (
          <div className="card-grid">
            {sorted.map((e) => (
              <div key={`${e.name}|${e.set}|${e.no}`} className="deck-card">
                <button className="card-hit" onClick={() => change(e, 1)} title={`Add a ${e.name}`}
                  onContextMenu={(ev) => { ev.preventDefault(); change(e, -1) }}>
                  <CardImg e={e} />
                </button>
                <span className="count">{e.count}</span>
                <div className="adjust">
                  <button onClick={() => change(e, -1)} aria-label={`Remove a ${e.name}`}>−</button>
                  <button onClick={() => change(e, 1)} aria-label={`Add a ${e.name}`}>+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <aside className="panel builder-search">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards: boss, dreepy, TWM 128" aria-label="Search cards" />
        {!cards.length && <p className="muted small">Loading cards…</p>}
        {query.trim().length >= 2 && cards.length > 0 && !results.length && <p className="muted small">No cards match.</p>}
        <div className="result-grid">
          {results.map((c) => {
            const e = { name: c.n, set: c.s, no: c.no, t: c.t }
            const n = entries.find((x) => same(x, e))?.count ?? 0
            return (
              <button key={`${c.s}-${c.no}`} className="card-hit result" onClick={() => change(e, 1)} title={`${c.n} ${c.s} ${c.no}`}>
                <CardImg e={e} />
                {n > 0 && <span className="count">{n}</span>}
              </button>
            )
          })}
        </div>
        <p className="muted small">Click a card to add it. In your deck, click to add one more and right-click (or −) to take one out.</p>
      </aside>
    </div>
  )
}
