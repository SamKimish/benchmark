import { deckSprites, spriteUrl } from '@/lib/archetypes'
import { prettyArch } from '@/lib/format'

/** A deck's Pokémon icons, as Limitless draws them. */
export default function Sprites({ arch }: { arch: string | null | undefined }) {
  const slugs = deckSprites(arch)
  return (
    <span className="sprites" title={arch ? prettyArch(arch) : undefined}>
      {slugs.map((s) => <img key={s} src={spriteUrl(s)} alt="" loading="lazy" width={36} height={36} />)}
    </span>
  )
}
