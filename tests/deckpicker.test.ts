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
