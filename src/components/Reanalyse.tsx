'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { reanalyseGames } from '@/app/games/actions'
import Pokeball from './Pokeball'

/**
 * When the parser has learnt something new (win reasons, Hammer decks), bring saved games up to date
 * in the background, a batch at a time, then show the refreshed log.
 */
export default function Reanalyse({ outdated }: { outdated: number }) {
  const router = useRouter()
  const [left, setLeft] = useState(outdated)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !outdated) return
    started.current = true
    ;(async () => {
      for (;;) {
        const r = await reanalyseGames().catch((e) => ({ done: 0, left: 0, error: e instanceof Error ? e.message : 'unknown error' }))
        if (r.error) return setError(r.error)
        setLeft(r.left)
        if (!r.left || !r.done) break
      }
      router.refresh()
    })()
  }, [outdated, router])
  if (!outdated || (!left && !error)) return null
  return (
    <p className="reanalyse muted small" role="status">
      {error ? <span className="error">Couldn&apos;t update your saved games: {error}</span>
        : <><Pokeball size={16} label="" /> Adding win reasons to your saved games… {outdated - left} of {outdated}</>}
    </p>
  )
}
