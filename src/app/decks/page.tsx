import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'
import { prettyArch } from '@/lib/format'
import type { Deck } from '@/lib/types'

const field = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

async function saveDeck(form: FormData) {
  'use server'
  const { supabase } = await requireUser()
  const row = {
    name: field(form, 'name'),
    version: field(form, 'version'),
    version_order: Number(field(form, 'version_order')) || 1,
    archetype: field(form, 'archetype') || null,
    decklist: field(form, 'decklist'),
    basics: field(form, 'basics') ? Number(field(form, 'basics')) : null,
    active: form.get('active') === 'on',
  }
  const id = field(form, 'id')
  if (id) await supabase.from('decks').update(row).eq('id', id)
  else await supabase.from('decks').insert(row)
  revalidatePath('/decks')
}

function DeckForm({ d }: { d?: Deck }) {
  return (
    <form action={saveDeck} className="form">
      {d && <input type="hidden" name="id" value={d.id} />}
      <div className="row">
        <label>Name<input name="name" required defaultValue={d?.name} placeholder="Straight Dragapult" /></label>
        <label>Version<input name="version" defaultValue={d?.version} placeholder="v3" size={8} /></label>
        <label>Order<input name="version_order" type="number" defaultValue={d?.version_order ?? 1} style={{ width: 70 }} /></label>
      </div>
      <div className="row">
        <label>Archetype<input name="archetype" defaultValue={d?.archetype ?? ''} placeholder="dragapult" /></label>
        <label>Basics<input name="basics" type="number" defaultValue={d?.basics ?? ''} style={{ width: 70 }} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input name="active" type="checkbox" defaultChecked={d?.active ?? true} /> Offer on upload</label>
      </div>
      <label>Decklist (TCG Live export)<textarea name="decklist" rows={d ? 4 : 8} defaultValue={d?.decklist} /></label>
      <div><button>{d ? 'Save' : 'Add deck'}</button></div>
    </form>
  )
}

export default async function Decks() {
  const { supabase } = await requireUser()
  const { data } = await supabase.from('decks').select('*').order('name').order('version_order', { ascending: false })
  const decks = (data ?? []) as Deck[]
  return (
    <>
      <h1>Decks</h1>
      <p className="muted">
        Each version of a list is its own deck, grouped by name. The archetype (a Limitless-style slug such as{' '}
        <code>dragapult</code> or <code>dragapult,dusknoir</code>) picks the deck automatically on upload.
      </p>
      <div className="grid2">
        <div className="panel"><h2 style={{ marginTop: 0 }}>New deck</h2><DeckForm /></div>
        {decks.map((d) => (
          <details key={d.id} className="panel">
            <summary><strong>{d.name}</strong> {d.version} <span className="muted small">· {prettyArch(d.archetype)}{d.active ? '' : ' · retired'}</span></summary>
            <DeckForm d={d} />
          </details>
        ))}
      </div>
    </>
  )
}
