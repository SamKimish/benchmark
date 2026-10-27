'use client'
import { spriteUrl } from '@/lib/archetypes'
import { cardSlug } from '@/lib/parser'

/** A Pokémon's Limitless sprite at its own size, from its card name ('Mega Excadrill ex'). */
export default function Mon({ name, small }: { name: string; small?: boolean }) {
  return (
    <span className={`mon${small ? ' small' : ''}`} title={name}>
      <img src={spriteUrl(cardSlug(name))} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
    </span>
  )
}
