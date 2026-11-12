import { describe, expect, it } from 'vitest'
import { typedSlug } from '@/components/DeckPicker'

describe('typedSlug', () => {
  it('turns a typed name into a Limitless-style key', () => {
    expect(typedSlug('mega rayquaza')).toBe('rayquaza-mega')
    expect(typedSlug('Mega Rayquaza ex')).toBe('rayquaza-mega')
    expect(typedSlug('  iron   crown ')).toBe('iron-crown')
    expect(typedSlug('')).toBe('')
  })
})

describe('spriteSlug', () => {
  it('maps our slugs to the names Limitless draws', async () => {
    const { spriteSlug } = await import('@/lib/archetypes')
    const { cardSlug } = await import('@/lib/parser')
    expect(spriteSlug('golurk-mega')).toBe('golurk')                      // no Mega Golurk sprite yet
    expect(spriteSlug(cardSlug('Mega Charizard X ex'))).toBe('charizard-mega-x')
    expect(spriteSlug(cardSlug('Fan Rotom'))).toBe('rotom-fan')
    expect(spriteSlug(cardSlug('Black Kyurem ex'))).toBe('kyurem-black')
    expect(spriteSlug(cardSlug('Paldean Clodsire ex'))).toBe('clodsire')
    expect(spriteSlug(cardSlug('Nidoran♀'))).toBe('nidoran-f')
    expect(spriteSlug('dragapult')).toBe('dragapult')
  })
})
