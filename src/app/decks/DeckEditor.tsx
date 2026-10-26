'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  basics, cardImage, cardKey, diffEntries, displayPrinting, formatDecklist, lookup, parseDecklist, resolvePrintings,
  sortEntries, total, type Card, type Entry,
} from '@/lib/decklist'
import { archetypeName, matchArchetypes } from '@/lib/archetypes'
import { prettyArch } from '@/lib/format'
import type { Deck } from '@/lib/types'
import { deckHistory, saveDeck } from './actions'
import DeckDiff from './DeckDiff'
import Pokeball from '@/components/Pokeball'
import Icon from '@/components/Icon'

let cardsPromise: Promise<Card[]> | null = null
const loadCards = () => (cardsPromise ??= fetch('/cards.json').then((r) => r.json() as Promise<Card[]>))

const SECTIONS: [Entry['t'], string][] = [['P', 'Pokémon'], ['T', 'Trainers'], ['E', 'Energy']]

const same = (a: Entry, b: { set: string; no: string; name: string }) => a.set === b.set && a.no === b.no && a.name === b.name

function CardImg({ e, cards, size = 'SM' }: { e: { name: string; set: string; no: string }; cards: Card[]; size?: 'SM' | 'LG' }) {
  const shown = displayPrinting(e, cards)
  const src = cardImage(shown.set, shown.no, size)
  // remembered per image, so a printing that failed before the card data loaded gets another go
  const [broken, setBroken] = useState<string | null>(null)
  if (!src || broken === src) return <div className="noimg card-img">{e.name}<span className="muted small">{e.set} {e.no}</span></div>
  return <img className="card-img" src={src} alt={`${e.name} ${e.set} ${e.no}`} loading="lazy" onError={() => setBroken(src)} />
}

export default function DeckEditor({ deck, latest }: {
  deck?: Deck
  /** the newest version of this deck, when that isn't the one being edited */
  latest?: { id: string; version: string; version_order: number }
}) {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>([])
  const index = useMemo(() => new Map(cards.map((c) => [cardKey(c.s, c.no), c])), [cards])
  const [saved, setSaved] = useState<Deck | undefined>(deck)
  const [entries, setEntries] = useState<Entry[]>(() => parseDecklist(deck?.decklist ?? ''))
  const [name, setName] = useState(deck?.name ?? '')
  const [archetype, setArchetype] = useState(deck?.archetype ?? '')
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(!deck)
  const [importText, setImportText] = useState('')
  const [history, setHistory] = useState<Deck[] | null>(null)
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({})
  const [busy, setBusy] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    loadCards().then((cs) => {
      setCards(cs)
      const idx = new Map(cs.map((c) => [cardKey(c.s, c.no), c]))
      setEntries((es) => resolvePrintings(es, cs).map((e) => ({ ...e, t: lookup(idx, e)?.t ?? e.t })))
    })
  }, [])

  const sorted = useMemo(() => sortEntries(entries, index), [entries, index])
  const text = useMemo(() => formatDecklist(sorted), [sorted])
  const count = total(entries)
  const savedEntries = useMemo(() => parseDecklist(saved?.decklist ?? ''), [saved])
  const changed = diffEntries(savedEntries, sorted).length > 0
  const newestOrder = Math.max(latest?.version_order ?? 0, saved?.version_order ?? 0)
  const nextVersion = saved ? `v${newestOrder + 1}` : 'v1'
  const older = latest && saved && latest.id !== saved.id

  const guesses = useMemo(() => matchArchetypes(entries.filter((e) => e.t === 'P').map((e) => e.name), 8, entries.some((e) => e.name === 'Crushing Hammer')), [entries])
  const best = guesses[0]
  const [dismissed, setDismissed] = useState(false)
  const askArchetype = best && best.key !== archetype.trim() && !dismissed

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const words = q.split(/\s+/)
    const out: Card[] = []
    for (let i = cards.length - 1; i >= 0 && out.length < 60; i--) {
      const c = cards[i]
      if (words.every((w) => `${c.n} ${c.s} ${c.no}`.toLowerCase().includes(w))) out.push(c)
    }
    return out
  }, [query, cards])

  const use = (a: { key: string; name: string }) => {
    setArchetype(a.key)
    setDismissed(true)
    if (!name.trim()) setName(a.name)
  }

  const change = (e: { name: string; set: string; no: string; t: Entry['t'] }, by: number) => {
    setStatus({})
    setEntries((es) => {
      const hit = es.find((x) => same(x, e))
      if (!hit) return by > 0 ? [...es, { name: e.name, set: e.set, no: e.no, t: e.t, count: by }] : es
      return es.map((x) => (x === hit ? { ...x, count: x.count + by } : x)).filter((x) => x.count > 0)
    })
  }

  function useList(listText: string) {
    const es = resolvePrintings(parseDecklist(listText, index), cards)
    if (!es.length) return setStatus({ error: 'No cards found in that text.' })
    setEntries(es)
    setImportText('')
    setImporting(false)
    const guess = matchArchetypes(es.filter((e) => e.t === 'P').map((e) => e.name), 6, es.some((e) => e.name === 'Crushing Hammer'))[0]
    if (guess) {
      if (!archetype.trim()) setArchetype(guess.key)
      if (!name.trim()) setName(guess.name)
    }
    setStatus({ ok: `Imported ${total(es)} cards` })
  }

  /** Import: take a decklist straight from the clipboard, or open the box to paste one by hand. */
  async function importList() {
    if (importing) return importText.trim() ? useList(importText) : setImporting(false)
    let t = ''
    try { t = await navigator.clipboard.readText() } catch { /* no clipboard permission */ }
    const looksLikeList = parseDecklist(t, index).length > 0
    if (!looksLikeList) {
      setImporting(true)
      return setStatus({ ok: 'Paste a decklist below.' })
    }
    if (count && !confirm(`Replace all ${count} cards with the list on your clipboard?`)) return
    useList(t)
  }

  async function save() {
    setBusy(true)
    const res = await saveDeck({
      id: saved?.id,
      name: (name.trim() || best?.name) ?? '',
      archetype: archetype.trim() || best?.key || null,
      decklist: text,
      basics: cards.length ? basics(entries, index) : saved?.basics ?? null,
      active: saved?.active ?? true,
    })
    setBusy(false)
    if (res.error) return setStatus({ error: res.error })
    if (!name.trim() && best) setName(best.name)
    if (!archetype.trim() && best) setArchetype(best.key)
    setStatus({ ok: res.newVersion ? `Saved as ${res.version}` : 'Saved' })
    setHistory(null)
    if (res.id !== saved?.id) router.replace(`/decks/${res.id}`)
    else router.refresh()
  }

  async function exportList() {
    try {
      await navigator.clipboard.writeText(text)
      setStatus({ ok: 'Copied for TCG Live' })
    } catch {
      setImportText(text)
      setImporting(true)
    }
  }

  return (
    <>
    <Link href="/decks" className="button secondary back-link"><Icon name="back" /> All decks</Link>
    <div className="builder">
      <section className="panel builder-deck">
        <div className="row">
          <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={best?.name ?? 'Deck name'} aria-label="Deck name" />
          <span className="version" title={changed ? `Saving stores this as ${nextVersion}` : 'Current version'}>
            {changed ? nextVersion : saved?.version ?? 'v1'}
          </span>
          <button onClick={save} disabled={busy || !count}>
            {busy ? <Pokeball size={18} label="Saving…" /> : <><Icon name="save" /> {changed && saved ? `Save as ${nextVersion}` : 'Save'}</>}
          </button>
          <button className={importing && importText.trim() ? '' : 'secondary'} onClick={importList}
            title="Import a decklist copied from TCG Live or Limitless (or paste one by hand)"><Icon name="import" /> Import</button>
          <button className="secondary" onClick={exportList} disabled={!count} title="Copy this list for TCG Live"><Icon name="export" /> Export</button>
          {saved && <button className="secondary" disabled={loadingHistory} onClick={async () => {
            if (history) return setHistory(null)
            setLoadingHistory(true)
            try { setHistory(await deckHistory(saved.line_id)) } finally { setLoadingHistory(false) }
          }} title="See the cards added and removed in each version">{loadingHistory ? <Pokeball size={18} label="History" /> : <><Icon name="history" /> History</>}</button>}
          <button className="secondary" onClick={() => { if (confirm('Remove every card?')) setEntries([]) }} disabled={!count} title="Remove every card"><Icon name="clear" /> Clear</button>
        </div>

        <div className="row small muted" style={{ marginTop: 10, alignItems: 'center' }}>
          <span className={count === 60 ? '' : 'error'}>Cards: {count}/60</span>
          {cards.length > 0 && <span>Basics: {basics(entries, index)}</span>}
          <span>Archetype: <strong>{archetypeName(archetype) ?? prettyArch(archetype) ?? 'none'}</strong></span>
          {status.ok && <span>{status.ok}</span>}
          {status.error && <span className="error">{status.error}</span>}
        </div>

        {older && (
          <div className="confirm">
            <span>You&apos;re looking at <strong>{saved.version}</strong>, an older version. Saving changes here makes a new {nextVersion}.</span>
            <Link href={`/decks/${latest.id}`} className="button secondary">Open {latest.version}, the current version</Link>
          </div>
        )}

        {askArchetype && (
          <div className="confirm">
            <span>This looks like <strong>{best.name}</strong>.</span>
            <button onClick={() => use(best)}>Use it</button>
            {guesses.length > 1 && (
              <select defaultValue="" aria-label="Another archetype"
                onChange={(e) => { const g = guesses.find((x) => x.id === e.target.value); if (g) use(g) }}>
                <option value="">Something else…</option>
                {guesses.slice(1).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
            <button className="secondary" onClick={() => setDismissed(true)}>Keep {archetypeName(archetype) ?? prettyArch(archetype)}</button>
          </div>
        )}

        {history && <DeckDiff versions={history} current={changed ? { version: nextVersion, entries: sorted, from: saved!.version } : null} onClose={() => setHistory(null)} />}

        {importing && (
          <div className="form" style={{ maxWidth: 'none', marginTop: 12 }}>
            <label>Paste a decklist exported from TCG Live or Limitless
              <textarea rows={10} value={importText} autoFocus onChange={(e) => setImportText(e.target.value)} placeholder={'Pokémon: 20\n4 Dreepy TWM 128\n…'} />
            </label>
            <div className="row">
              <button disabled={!importText.trim()} onClick={() => useList(importText)}>
                <Icon name="import" /> {count ? `Replace all ${count} cards` : 'Import list'}
              </button>
              {count > 0 && <button className="secondary" onClick={() => setImporting(false)}>Cancel</button>}
            </div>
          </div>
        )}

        {count === 0 && !importing ? (
          <p className="muted" style={{ marginTop: 24 }}>No cards yet. Search to add cards, or press Import to bring in a list you've copied.</p>
        ) : (
          <>
            {SECTIONS.map(([t, label]) => {
              const es = sorted.filter((e) => (e.t ?? 'P') === t)
              if (!es.length) return null
              return (
                <div key={t} className="deck-section">
                  <h3>{label} <span className="muted">{total(es)}</span></h3>
                  <div className="card-grid">
                    {es.map((e) => (
                      <div key={`${e.name}|${e.set}|${e.no}`} className="deck-card">
                        <button className="card-hit" onClick={() => change(e, 1)} title={`Add a ${e.name}`}
                          onContextMenu={(ev) => { ev.preventDefault(); change(e, -1) }}>
                          <CardImg e={e} cards={cards} />
                        </button>
                        <span className="count">{e.count}</span>
                        <div className="adjust">
                          <button onClick={() => change(e, -1)} aria-label={`Remove a ${e.name}`}>−</button>
                          <button onClick={() => change(e, 1)} aria-label={`Add a ${e.name}`}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </section>

      <aside className="panel builder-search">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards: boss, dreepy, TWM 128" aria-label="Search cards" />
        {!cards.length && <Pokeball size={32} label="Loading cards…" />}
        {query.trim().length >= 2 && cards.length > 0 && !results.length && <p className="muted small">No cards match.</p>}
        <div className="result-grid">
          {results.map((c) => {
            const e = { name: c.n, set: c.s, no: c.no, t: c.t }
            const n = entries.find((x) => same(x, e))?.count ?? 0
            return (
              <button key={`${c.s}-${c.no}`} className="card-hit result" onClick={() => change(e, 1)} title={`${c.n} ${c.s} ${c.no}`}>
                <CardImg e={e} cards={cards} />
                {n > 0 && <span className="count">{n}</span>}
              </button>
            )
          })}
        </div>
        <p className="muted small">Click a card to add it. In your deck, click to add one more and right-click (or −) to take one out.</p>
      </aside>
    </div>
    </>
  )
}
