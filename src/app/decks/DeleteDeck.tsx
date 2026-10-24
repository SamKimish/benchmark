'use client'
import { deleteDeck } from './actions'

export default function DeleteDeck({ id, name }: { id: string; name: string }) {
  return (
    <button className="icon" title="Delete deck" aria-label={`Delete ${name}`}
      onClick={async () => { if (confirm(`Delete ${name}? Its games stay, without a deck.`)) await deleteDeck(id) }}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
    </button>
  )
}
