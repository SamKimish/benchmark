'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/GameDialog'
import Icon from '@/components/Icon'
import { deleteTournament } from './actions'

export default function DeleteTournament({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="icon-btn danger-hover" onClick={() => setOpen(true)} title="Delete this tournament" aria-label="Delete this tournament">
        <Icon name="trash" size={20} />
      </button>
      {open && (
        <ConfirmDialog title="Delete this tournament?" confirm="Delete tournament" onClose={() => setOpen(false)}
          body={<p><strong>{name}</strong> and all its rounds will be removed. Your decks and ladder games aren&apos;t touched. This can&apos;t be undone.</p>}
          onConfirm={async () => {
            const r = await deleteTournament(id)
            if (r.error) return r.error
            router.push('/tournaments')
            router.refresh()
          }} />
      )}
    </>
  )
}
