import { deckSprites, spriteUrl } from '@/lib/archetypes'
import { prettyArch } from '@/lib/format'

/**
 * A deck's Pokémon icons, as Limitless draws them. The sprites are small bitmaps of different sizes
 * (Clefairy is 18px, Dragapult 41px), so each sits in a fixed slot at its own size rather than being
 * stretched to a common height, which would blur the small ones.
 */
export default function Sprites({ arch }: { arch: string | null | undefined }) {
  const slugs = deckSprites(arch)
  return (
    <span className="sprites" title={arch ? prettyArch(arch) : undefined}>
      {slugs.map((s) => <span key={s} className="sprite"><img src={spriteUrl(s)} alt="" loading="lazy" /></span>)}
    </span>
  )
}
