import { deckSprites, spriteUrl } from '@/lib/archetypes'
import { prettyArch } from '@/lib/format'

/**
 * A deck's Pokémon icons, as Limitless draws them. The sprites are small bitmaps of different sizes
 * (Clefairy is 18px, Dragapult 41px), so each sits in a fixed slot at its own size rather than being
 * stretched to a common height, which would blur the small ones. `slugs` draws chosen sprites as they are;
 * otherwise they are worked out from the deck key `arch`.
 */
export default function Sprites({ arch, slugs, title }: { arch?: string | null; slugs?: string[]; title?: string }) {
  const shown = slugs?.length ? slugs.slice(0, 2) : deckSprites(arch)
  return (
    <span className="sprites" title={title ?? (arch ? prettyArch(arch) : undefined)}>
      {shown.map((s) => <span key={s} className="sprite"><img src={spriteUrl(s)} alt="" loading="lazy" /></span>)}
    </span>
  )
}
