'use client'
import { useTransition } from 'react'
import { archiveDeck } from './actions'
import Icon from '@/components/Icon'

/** Moves a deck into the Archived section, or back out of it. */
export default function ArchiveDeck({ lineId, name, archived }: { lineId: string; name: string; archived: boolean }) {
  const [pending, start] = useTransition()
  const label = archived ? `Bring ${name} back` : `Archive ${name}`
  return (
    <button className={`icon archive-btn${pending ? ' pending' : ''}`} title={archived ? 'Unarchive' : 'Archive (rotated out or retired)'}
      aria-label={label} disabled={pending}
      onClick={() => start(async () => {
        const err = await archiveDeck(lineId, !archived)
        if (err) alert(`Couldn't ${archived ? 'unarchive' : 'archive'} ${name}: ${err}`)
      })}>
      <Icon name={archived ? 'unarchive' : 'archive'} size={18} />
    </button>
  )
}
