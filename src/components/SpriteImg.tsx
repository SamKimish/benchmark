'use client'
import { fallbackSpriteUrl, spriteUrl } from '@/lib/archetypes'

/**
 * A Pokémon's Limitless sprite. When Limitless has none (a brand-new Mega, say), it falls back to the
 * regular form, and if that is missing too the slot stays empty rather than showing a broken image.
 */
export default function SpriteImg({ slug }: { slug: string }) {
  return (
    <img src={spriteUrl(slug)} alt="" loading="lazy" onError={(e) => {
      const img = e.currentTarget, next = fallbackSpriteUrl(slug)
      if (next && img.src !== next) img.src = next
      else img.style.visibility = 'hidden'
    }} />
  )
}
