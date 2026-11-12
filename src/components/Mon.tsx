'use client'
import SpriteImg from './SpriteImg'
import { cardSlug } from '@/lib/parser'

/** A Pokémon's Limitless sprite at its own size, from its card name ('Mega Excadrill ex'). */
export default function Mon({ name, small }: { name: string; small?: boolean }) {
  return (
    <span className={`mon${small ? ' small' : ''}`} title={name}>
      <SpriteImg slug={cardSlug(name)} />
    </span>
  )
}
