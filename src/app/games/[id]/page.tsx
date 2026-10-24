import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'
import { gameRow } from '@/lib/games'
import { deckLabel, prettyArch, shortDate } from '@/lib/format'
import type { Deck, Game } from '@/lib/types'
import SubmitButton from '@/components/SubmitButton'

async function save(form: FormData) {
  'use server'
  const { supabase } = await requireUser()
  const id = String(form.get('id'))
  const deckId = String(form.get('deck_id') ?? '') || null
  const { data: game } = await supabase.from('games').select('log, deck_id').eq('id', id).single()
  if (!game) notFound()
  const patch: Record<string, unknown> = {
    result: String(form.get('result') ?? '') || null,
    opp_archetype: String(form.get('opp_archetype') ?? '').trim() || null,
    notes: String(form.get('notes') ?? ''),
    deck_id: deckId,
  }
  if (deckId !== game.deck_id) {
    // a different deck can mean a different game plan, so the stats are worked out again
    const { data: deck } = deckId ? await supabase.from('decks').select('archetype').eq('id', deckId).single() : { data: null }
    const r = gameRow(game.log, deck?.archetype)
    Object.assign(patch, { stats: r.stats, tags: r.tags, my_archetype: r.my_archetype })
  }
  await supabase.from('games').update(patch).eq('id', id)
  revalidatePath('/')
  redirect(`/games/${id}`)
}

async function remove(form: FormData) {
  'use server'
  const { supabase } = await requireUser()
  await supabase.from('games').delete().eq('id', String(form.get('id')))
  revalidatePath('/')
  redirect('/')
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireUser()
  const [{ data: g }, { data: decks }] = await Promise.all([
    supabase.from('games').select('*').eq('id', id).maybeSingle(),
    supabase.from('decks').select('*').order('name').order('version_order', { ascending: false }),
  ])
  if (!g) notFound()
  const game = g as Game
  const s = game.stats
  const deck = (decks as Deck[]).find((d) => d.id === game.deck_id)
  return (
    <>
      <p><Link href="/">← Match log</Link></p>
      <h1>
        <span className={`badge ${game.result ?? 'none'}`}>{game.result === 'W' ? 'Win' : game.result === 'L' ? 'Loss' : '?'}</span>{' '}
        {deckLabel(deck)} vs {prettyArch(game.opp_archetype)}
      </h1>
      <p className="muted">{shortDate(game.played_at)} · vs {game.opponent ?? 'unknown'} · went {s.went_first ? 'first' : 'second'} · {s.end_reason}</p>
      {game.result === 'L' && <p>{game.tags.map((t) => <span key={t} className="pill">{t}</span>)}</p>}

      <div className="grid2">
        <div className="panel">
          <dl className="kv">
            <dt>Prizes</dt><dd>{s.prizes_taken} taken, {s.prizes_given} given</dd>
            <dt>Prize race</dt><dd>{s.prize_states.slice(1).map(([a, b]) => `${a}–${b}`).join(', ') || 'No prizes taken'}</dd>
            <dt>First prize</dt><dd>{s.first_prize}</dd>
            <dt>Turns</dt><dd>{s.my_turns} mine, {s.opp_turns} theirs</dd>
            <dt>Mulligans</dt><dd>{s.mulligans} mine, {s.opp_mulligans} theirs</dd>
            <dt>Opening active</dt><dd>{s.opening_active ?? '–'}</dd>
            <dt>Opening hand</dt><dd>{s.opening_hand.join(', ') || '–'}</dd>
            <dt>Attacker online</dt><dd>{s.first_attacker_turn ? `My turn ${s.first_attacker_turn}` : 'Never'}</dd>
            {s.dive_placements > 0 && <><dt>Phantom Dive</dt><dd>{s.dive_converted} of {s.dive_placements} spreads turned into KOs</dd></>}
            {s.hammers_played > 0 && <><dt>Crushing Hammer</dt><dd>{s.hammer_heads} heads from {s.hammers_played}</dd></>}
            <dt>Their Pokémon</dt><dd>{s.opp_pokemon.join(', ') || '–'}</dd>
          </dl>
        </div>
        <form action={save} className="panel form">
          <input type="hidden" name="id" value={game.id} />
          <label>Deck
            <select name="deck_id" defaultValue={game.deck_id ?? ''}>
              <option value="">No deck</option>
              {(decks as Deck[]).map((d) => <option key={d.id} value={d.id}>{deckLabel(d)}</option>)}
            </select>
          </label>
          <label>Opponent deck<input name="opp_archetype" defaultValue={game.opp_archetype ?? ''} /></label>
          <label>Result
            <select name="result" defaultValue={game.result ?? ''}>
              <option value="">Unknown</option><option value="W">Win</option><option value="L">Loss</option>
            </select>
          </label>
          <label>Notes<textarea name="notes" rows={3} defaultValue={game.notes} style={{ fontFamily: 'inherit' }} /></label>
          <div className="row"><SubmitButton pending="Saving…">Save</SubmitButton></div>
        </form>
      </div>

      <h2>Log</h2>
      <pre className="log">{game.log}</pre>
      <form action={remove}>
        <input type="hidden" name="id" value={game.id} />
        <SubmitButton className="secondary" pending="Deleting…">Delete this game</SubmitButton>
      </form>
    </>
  )
}
