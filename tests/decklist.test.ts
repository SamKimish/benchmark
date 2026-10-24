import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { basics, cardImage, cardKey, formatDecklist, parseDecklist, total, type Card } from '@/lib/decklist'

const cards: Card[] = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url), 'utf8'))
const index = new Map(cards.map((c) => [cardKey(c.s, c.no), c]))
const V2 = `Pokémon: 20
4 Dreepy ASC 247
4 Drakloak ASC 248
3 Dragapult ex PRE 165
2 Munkidori SFA 72
2 Budew ASC 221
1 Fezandipiti ex ASC 288
1 Lillie's Clefairy ex ASC 280
1 Moltres PFL 14
1 Meowth ex POR 121
1 Psyduck ASC 226

Trainer: 30
4 Lillie's Determination MEG 169
3 Boss's Orders ASC 256
2 Crispin SCR 164
1 Judge PAF 228
1 Rosa's Encouragement POR 114
4 Buddy-Buddy Poffin MEG 167
4 Poké Pad POR 113
3 Ultra Ball ASC 264
3 Night Stretcher MEG 173
1 Unfair Stamp TWM 165
1 Special Red Card CRI 113
2 Risky Ruins MEG 127
1 Jamming Tower ASC 261

Energy: 10
4 Basic {P} Energy SVE 5
4 Basic {R} Energy SVE 2
2 Basic {D} Energy MEE 15
`

describe('decklists', () => {
  it('round-trips a TCG Live export', () => {
    const es = parseDecklist(V2, index)
    expect(total(es)).toBe(60)
    expect(es.find((e) => e.name === 'Basic Psychic Energy')).toMatchObject({ count: 4, set: 'SVE', no: '5', t: 'E' })
    expect(formatDecklist(es)).toBe(V2)
  })

  it('counts Basic Pokémon from the card data', () => {
    expect(basics(parseDecklist(V2, index), index)).toBe(13)
  })

  it('builds Limitless image URLs', () => {
    expect(cardImage('POR', '71')).toBe('https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/POR/POR_071_R_EN_SM.png')
  })
})

describe('lists without set codes', () => {
  it('picks a printing for each card', async () => {
    const { resolvePrintings } = await import('@/lib/decklist')
    const es = resolvePrintings(parseDecklist('4 Dreepy\n4 Crushing Hammer\n3 Basic {R} Energy'), cards)
    expect(es.every((e) => e.set && e.no)).toBe(true)
    expect(es[2]).toMatchObject({ name: 'Basic Fire Energy', t: 'E' })
  })
})

describe('versions and archetypes', () => {
  it('lists what changed between two lists', async () => {
    const { diffEntries } = await import('@/lib/decklist')
    const v3 = V2.replace('1 Psyduck ASC 226', '1 Chi-Yu TWM 39').replace('1 Jamming Tower ASC 261', '4 Crushing Hammer POR 71')
    const d = diffEntries(parseDecklist(V2, index), parseDecklist(v3, index))
    expect(d.map((c) => `${c.to - c.from > 0 ? '+' : '−'}${Math.abs(c.to - c.from)} ${c.name}`))
      .toEqual(['+4 Crushing Hammer', '+1 Chi-Yu', '−1 Jamming Tower', '−1 Psyduck'])
  })

  it('names a decklist after its Limitless archetype', async () => {
    const { matchArchetypes } = await import('@/lib/archetypes')
    expect(matchArchetypes(['Dreepy', 'Drakloak', 'Dragapult ex', 'Budew'])[0]).toMatchObject({ name: 'Dragapult', key: 'dragapult' })
    expect(matchArchetypes(['Dreepy', 'Dragapult ex', 'Duskull', 'Dusclops', 'Dusknoir'])[0])
      .toMatchObject({ name: 'Dragapult Dusknoir', key: 'dragapult,dusknoir' })
  })
})

describe('change history', () => {
  it('treats Poke Pad and Poké Pad as the same card', async () => {
    const { diffEntries } = await import('@/lib/decklist')
    expect(diffEntries(parseDecklist('4 Poke Pad\n3 Ultra Ball'), parseDecklist('4 Poké Pad\n4 Ultra Ball'))).toEqual([{ name: 'Ultra Ball', from: 3, to: 4 }])
  })
})
