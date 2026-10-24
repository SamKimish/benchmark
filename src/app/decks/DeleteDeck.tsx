'use client'
import { deleteDeck } from './actions'
import Icon from '@/components/Icon'

export default function DeleteDeck({ lineId, name, versions }: { lineId: string; name: string; versions: number }) {
  return (
    <button className="icon" title="Delete deck" aria-label={`Delete ${name}`}
      onClick={async () => {
        const what = versions > 1 ? `${name} and all ${versions} versions` : name
        if (confirm(`Delete ${what}? Its games stay, without a deck.`)) await deleteDeck(lineId)
      }}>
      <Icon name="trash" size={18} />
    </button>
  )
}
