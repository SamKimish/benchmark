'use client'
import { useState } from 'react'
import { saveNotes } from '@/app/games/actions'

/** Notes on a game, saved when you click away. */
export default function GameNotes({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle')
  async function save() {
    if (text === saved) return
    setState('saving')
    const r = await saveNotes(id, text)
    if (r.error) return setState(r.error)
    setSaved(text)
    setState('saved')
  }
  return (
    <div className="notes">
      <textarea value={text} rows={3} placeholder="What would you do differently?" onChange={(e) => { setText(e.target.value); setState('idle') }} onBlur={save} />
      <span className={`small ${state.length > 6 ? 'error' : 'muted'}`}>{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'idle' ? '' : state}</span>
    </div>
  )
}
