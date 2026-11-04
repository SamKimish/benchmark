'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deckLabel } from '@/lib/format'
import {
  cleanGames, emptyRound, KINDS, matchResult, record, recordText, type Round, type Tournament,
} from '@/lib/tournaments'
import type { Deck } from '@/lib/types'
import DeckPicker from '@/components/DeckPicker'
import Sprites from '@/components/Sprites'
import Icon from '@/components/Icon'
import Pokeball from '@/components/Pokeball'
import { saveTournament } from './actions'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
const NEW_LIST = '__new'
const num = (s: string) => (s.trim() ? Math.max(0, Math.floor(Number(s))) || null : null)

/** One round: the opponent's deck, the games (tap W / L / T, or type 'WLW'), a bye or ID, and optional details. */
function RoundRow({ i, r, onChange, onRemove }: { i: number; r: Round; onChange: (r: Round) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(Boolean(r.opponent || r.notes))
  const m = matchResult(r)
  const add = (g: 'W' | 'L' | 'T') => onChange({ ...r, special: null, games: cleanGames(r.games + g) })
  return (
    <li className={`round-edit ${m ?? 'none'}`}>
      <span className="round-n">{i + 1}</span>
      <div className="round-opp">
        {r.special === 'bye' ? <span className="muted round-bye">Bye</span>
          : <DeckPicker label={`Round ${i + 1} opponent's deck`} value={r.opp ?? ''} onChange={(k) => onChange({ ...r, opp: k || null })} />}
      </div>
      <div className="round-games">
        <div className="games-entry">
          <input aria-label={`Round ${i + 1} games`} className={`games-input ${m ?? ''}`} value={r.special === 'bye' ? '' : r.special === 'id' ? 'ID' : r.games}
            placeholder="WLW" disabled={!!r.special}
            onChange={(e) => onChange({ ...r, special: null, games: cleanGames(e.target.value) })} />
          {!r.special && (
            <span className="games-tap">
              {(['W', 'L', 'T'] as const).map((g) => (
                <button key={g} type="button" className={`game-btn ${g}`} onClick={() => add(g)} disabled={r.games.length >= 5}
                  title={g === 'W' ? 'Won a game' : g === 'L' ? 'Lost a game' : 'Game tied (time called)'}>{g}</button>
              ))}
              <button type="button" className="game-btn undo" onClick={() => onChange({ ...r, games: r.games.slice(0, -1) })}
                disabled={!r.games} title="Undo the last game" aria-label="Undo the last game">⌫</button>
            </span>
          )}
        </div>
        <span className="seg special">
          {(['bye', 'id'] as const).map((s) => (
            <button key={s} type="button" className={r.special === s ? 'on' : ''} aria-pressed={r.special === s}
              title={s === 'bye' ? 'A bye counts as a win' : 'An intentional draw counts as a tie'}
              onClick={() => onChange({ ...r, special: r.special === s ? null : s, games: '' })}>{s === 'bye' ? 'Bye' : 'ID'}</button>
          ))}
        </span>
      </div>
      <span className={`round-result ${m ?? ''}`}>{m === 'W' ? 'Win' : m === 'L' ? 'Loss' : m === 'T' ? 'Tie' : '–'}</span>
      <span className="round-tools">
        <button type="button" className="icon-btn" onClick={() => setOpen((x) => !x)} title="Opponent's name and notes" aria-expanded={open} aria-label="Opponent's name and notes"><Icon name="edit" size={17} /></button>
        <button type="button" className="icon-btn danger-hover" onClick={onRemove} title="Remove this round" aria-label="Remove this round"><Icon name="trash" size={17} /></button>
      </span>
      {open && (
        <div className="round-more">
          <label>Opponent<input value={r.opponent} maxLength={80} placeholder="Their name (optional)" onChange={(e) => onChange({ ...r, opponent: e.target.value })} /></label>
          <label className="grow">Notes<input value={r.notes} maxLength={500} placeholder="Prized Rare Candy game 2, went first every game…" onChange={(e) => onChange({ ...r, notes: e.target.value })} /></label>
        </div>
      )}
    </li>
  )
}

/** Logging an in-person event, or changing one: what it was, the list you played, where you finished, and every round. */
export default function TournamentEditor({ t, decks }: { t?: Tournament; decks: Deck[] }) {
  const router = useRouter()
  const [name, setName] = useState(t?.name ?? '')
  const [kind, setKind] = useState<string>(t?.kind ?? 'locals')
  const [format, setFormat] = useState(t?.format ?? 'Standard')
  const [location, setLocation] = useState(t?.location ?? '')
  const [start, setStart] = useState(t?.start_date ?? today())
  const [end, setEnd] = useState(t?.end_date ?? '')
  const newest = [...decks].sort((a, b) => Number(b.active) - Number(a.active) || b.created_at.localeCompare(a.created_at))[0]
  const [deckId, setDeckId] = useState<string>(t ? t.deck_id ?? '' : newest?.id ?? '')
  const [arch, setArch] = useState(t?.my_archetype ?? '')
  const [listName, setListName] = useState('')
  const [listText, setListText] = useState('')
  const [placement, setPlacement] = useState(t?.placement ? String(t.placement) : '')
  const [players, setPlayers] = useState(t?.players ? String(t.players) : '')
  const [rounds, setRounds] = useState<Round[]>(t?.rounds.length ? t.rounds : [emptyRound()])
  const [notes, setNotes] = useState(t?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deck = decks.find((d) => d.id === deckId)
  const myArch = deck?.archetype ?? (arch || null)
  const rec = record(rounds)
  // decks grouped by name, newest version first; retired versions stay pickable for older events
  const names = [...new Set(decks.map((d) => d.name))]

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const r = await saveTournament({
        id: t?.id, name, kind, format, location, startDate: start, endDate: end || null,
        deckId: deckId && deckId !== NEW_LIST ? deckId : null, myArchetype: deck ? null : arch || null,
        placement: num(placement), players: num(players), rounds, notes,
        newDeck: deckId === NEW_LIST ? { name: listName, decklist: listText } : null,
      })
      if (r.error || !r.id) { setError(r.error ?? 'Something went wrong.'); return }
      router.push(`/tournaments/${r.id}`)
      router.refresh()
    } catch (e) {
      setError(`Couldn't save: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const setRound = (i: number, r: Round) => setRounds(rounds.map((x, j) => (j === i ? r : x)))

  return (
    <>
      <Link href={t ? `/tournaments/${t.id}` : '/tournaments'} className="button secondary back-link"><Icon name="back" /> {t ? t.name : 'Tournaments'}</Link>
      <div className="page-head">
        <h1>{t ? 'Edit tournament' : 'Log a tournament'}</h1>
        <div className="page-actions">
          <span className="editor-record" title="Wins-losses-ties">{recordText(rec)}</span>
          <button onClick={save} disabled={saving}>{saving ? <Pokeball size={18} label="Saving…" /> : <><Icon name="save" /> Save tournament</>}</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="t-editor">
        <section className="panel t-section">
          <h2>Event</h2>
          <div className="t-grid">
            <label className="span2">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gdańsk Regionals" maxLength={120} autoFocus={!t} /></label>
            <div className="span2">
              <span className="field-label">Type</span>
              <div className="kind-picker" role="radiogroup" aria-label="Tournament type">
                {KINDS.map((k) => (
                  <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className={`kind ${kind === k.key ? 'on' : ''}`} onClick={() => setKind(k.key)}>{k.label}</button>
                ))}
              </div>
            </div>
            <label>Date<input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
            <label><span>Last day <span className="muted small">(multi-day events)</span></span><input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></label>
            <label>Format<input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="Standard, TEF–MEG" maxLength={40} /></label>
            <label>Where<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Store or venue (optional)" maxLength={120} /></label>
          </div>
        </section>

        <section className="panel t-section">
          <h2>Your deck</h2>
          <div className="t-deck">
            <Sprites arch={myArch} />
            <label className="grow">Decklist
              <select value={deckId} onChange={(e) => setDeckId(e.target.value)}>
                <option value="">No saved list</option>
                <option value={NEW_LIST}>+ Paste a new list…</option>
                {names.map((n) => (
                  <optgroup key={n} label={n}>
                    {decks.filter((d) => d.name === n).sort((a, b) => b.version_order - a.version_order).map((d) => (
                      <option key={d.id} value={d.id}>{deckLabel(d)}{d.active ? '' : ' (retired)'}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          {deckId === NEW_LIST && (
            <div className="t-newlist">
              <label>Deck name<input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Named from the list if left blank" maxLength={80} /></label>
              <label><span>List <span className="muted small">TCG Live export; it&apos;s saved to Decks as a new deck</span></span>
                <textarea rows={8} value={listText} onChange={(e) => setListText(e.target.value)} placeholder={'Pokémon: 20\n4 Dreepy TWM 128\n…'} />
              </label>
            </div>
          )}
          {!deck && (
            <div className="t-arch">
              <DeckPicker label={deckId === NEW_LIST ? 'Archetype (guessed from the list if left empty)' : 'Archetype'} value={arch} onChange={setArch} />
            </div>
          )}
          {deck && <p className="muted small">Played as {deckLabel(deck)}. <Link href={`/decks/${deck.id}`} target="_blank">See the list</Link></p>}

          <h2>Finish</h2>
          <div className="t-finish">
            <label>Placed<input type="number" min={1} inputMode="numeric" value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="12" /></label>
            <span className="muted">of</span>
            <label>Players<input type="number" min={1} inputMode="numeric" value={players} onChange={(e) => setPlayers(e.target.value)} placeholder="340" /></label>
          </div>
        </section>
      </div>

      <section className="t-rounds">
        <div className="log-head">
          <h2>Rounds</h2>
          <span className="muted small">Tap W, L or T for each game, or type them: <strong>WLW</strong>. Byes count as wins, IDs as ties.</span>
        </div>
        <ol className="rounds-edit">
          {rounds.map((r, i) => (
            <RoundRow key={i} i={i} r={r} onChange={(x) => setRound(i, x)} onRemove={() => setRounds(rounds.filter((_, j) => j !== i))} />
          ))}
        </ol>
        <button type="button" className="secondary add-round" onClick={() => setRounds([...rounds, emptyRound()])} disabled={rounds.length >= 30}>
          <Icon name="plus" /> Add round
        </button>
      </section>

      <section>
        <h2>Notes</h2>
        <textarea className="t-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How the day went, what you'd change in the list…" />
      </section>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Link href={t ? `/tournaments/${t.id}` : '/tournaments'} className="button secondary">Cancel</Link>
        <button onClick={save} disabled={saving}>{saving ? <Pokeball size={18} label="Saving…" /> : <><Icon name="save" /> Save tournament</>}</button>
      </div>
    </>
  )
}
