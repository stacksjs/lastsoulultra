import { describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import { CARD_HEIGHT, CARD_WIDTH, cards, shareCard } from '../resources/data/share'
import { indexablePaths } from '../resources/data/site'

/**
 * Share cards are the one part of a page nobody on the team ever sees: they
 * render in someone else's app, days later, and a wrong one looks deliberate.
 * The site shipped nine cards it never referenced for exactly that reason, so
 * these tests check the file on disk rather than the mapping alone.
 */

/** Width and height off the JPEG's own SOF marker, not off a filename. */
function jpegSize(bytes: Uint8Array): { width: number, height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2 // skip SOI
  while (offset < bytes.length) {
    if (view.getUint8(offset) !== 0xFF)
      throw new Error('not a JPEG segment boundary')
    const marker = view.getUint8(offset + 1)
    const length = view.getUint16(offset + 2)
    // SOF0..SOF15, minus the four markers in that range that are not frames.
    if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker))
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }
    offset += 2 + length
  }
  throw new Error('no frame header')
}

describe('share cards', () => {
  it('serves every card from a file that is actually on disk', async () => {
    for (const card of Object.values(cards)) {
      const file = Bun.file(`public${card.src}`)
      expect(await file.exists()).toBe(true)
    }
  })

  it('ships each card at the size the card slot crops to', async () => {
    for (const card of Object.values(cards)) {
      const bytes = new Uint8Array(await Bun.file(`public${card.src}`).arrayBuffer())
      expect(jpegSize(bytes)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT })
    }
  })

  it('gives every indexable page a card', () => {
    for (const path of indexablePaths)
      expect(shareCard(path).src.endsWith('.jpg')).toBe(true)
  })

  it('falls back to the default card rather than to nothing', () => {
    expect(shareCard('/404')).toEqual(cards.default)
    expect(shareCard('/a-page-that-does-not-exist')).toEqual(cards.default)
  })

  it('describes what each card reads, not just the photograph behind it', () => {
    for (const card of Object.values(cards)) {
      expect(card.alt.length).toBeGreaterThan(40)
      expect(card.alt).toContain('captioned')
    }
  })
})

describe('the head partial', () => {
  async function head(): Promise<string> {
    return processDirectives('@include(\'head\')', {}, resolve('resources/views/index.stx'), {
      enabled: true,
      cache: false,
      partialsDir: resolve('resources/partials'),
      componentsDir: resolve('resources/components'),
    }, new Set())
  }

  it('points both card slots at the same absolute JPEG', async () => {
    const html = await head()
    const og = html.match(/property="og:image" content="([^"]+)"/)?.[1]
    const twitter = html.match(/name="twitter:image" content="([^"]+)"/)?.[1]

    expect(og).toBe(twitter)
    expect(og?.startsWith('http')).toBe(true)
    expect(og?.endsWith('.jpg')).toBe(true)
  })

  it('declares the card size, so a scraper need not fetch it to lay it out', async () => {
    const html = await head()
    expect(html).toContain(`content="${CARD_WIDTH}"`)
    expect(html).toContain(`content="${CARD_HEIGHT}"`)
  })

  it('escapes the quotes inside an alt rather than ending the attribute early', async () => {
    const html = await head()
    const alt = html.match(/property="og:image:alt" content="([^"]+)"/)?.[1] ?? ''

    expect(alt).toContain('&quot;')
    expect(alt).not.toContain('"')
  })
})
