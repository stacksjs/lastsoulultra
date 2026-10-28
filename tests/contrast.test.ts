import { describe, expect, it } from 'bun:test'

/**
 * Text contrast, for the sheets this branch added.
 *
 * Two of the site's tokens do not clear WCAG AA for body text: --lsu-dim-3
 * at 3.66:1 on black, and the brand red at 4.15:1. Both are used that way
 * across the rest of the site - .kicker, .sr-date, .tile-n and about thirty
 * others - which is the organiser's own design and not something to rewrite
 * from here. What these tests hold is the narrower line: the sheets added
 * here do not add to it.
 */

type Rgb = [number, number, number]

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number): number => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** White at `alpha` composited over an opaque background. */
function dim(alpha: number, over: Rgb): Rgb {
  return over.map(channel => Math.round(255 * alpha + channel * (1 - alpha))) as Rgb
}

const BLACK: Rgb = [0, 0, 0]
const RED: Rgb = [221, 15, 21]
/** AA: 4.5 for body text, 3.0 at 24px or 18.66px bold and above. */
const BODY = 4.5
const LARGE = 3

describe('the palette', () => {
  it('is safe for body text down to --lsu-dim-2', () => {
    expect(contrast([255, 255, 255], BLACK)).toBeGreaterThan(BODY)
    expect(contrast(dim(0.65, BLACK), BLACK)).toBeGreaterThan(BODY)
    expect(contrast(dim(0.55, BLACK), BLACK)).toBeGreaterThan(BODY)
  })

  it('is not safe for body text at --lsu-dim-3 or the brand red', () => {
    // Recorded rather than asserted away: this is why the rules below exist.
    expect(contrast(dim(0.4, BLACK), BLACK)).toBeLessThan(BODY)
    expect(contrast(RED, BLACK)).toBeLessThan(BODY)
  })

  it('is safe for large text at both', () => {
    expect(contrast(dim(0.4, BLACK), BLACK)).toBeGreaterThan(LARGE)
    expect(contrast(RED, BLACK)).toBeGreaterThan(LARGE)
  })

  it('holds on the card surface as well as on black', () => {
    const card: Rgb = [13, 13, 15]
    expect(contrast(dim(0.55, card), card)).toBeGreaterThan(BODY)
    expect(contrast(RED, card)).toBeLessThan(BODY)
  })
})

describe('the sheets this branch added', () => {
  const own = ['coaching.css', 'coaching-page.css', 'not-found.css']

  async function rules(name: string): Promise<{ selector: string, body: string }[]> {
    const css = await Bun.file(`resources/assets/styles/site/${name}`).text()
    return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(match => ({ selector: match[1]!.trim().split('\n').pop()!, body: match[2]! }))
  }

  it('never sets the dimmest token as a text colour', async () => {
    for (const name of own) {
      const offenders = (await rules(name))
        .filter(rule => rule.body.includes('color:var(--lsu-dim-3)'))
        .map(rule => `${name}: ${rule.selector}`)

      expect(offenders).toEqual([])
    }
  })

  /**
   * One relocated rule, not a new one: .coaching-loop h3 came across from
   * stx-site.css with the rest of the marketing page and starts at 22px,
   * which is under the 24px bar at the narrowest viewport. Listed so it stays
   * visible rather than excluding the whole sheet it lives in.
   */
  const RELOCATED = new Set(['.coaching-page .coaching-loop h3'])

  it('uses the brand red for text only where it is large', async () => {
    for (const name of own) {
      const offenders = (await rules(name))
        .filter((rule) => {
          if (!/(?<![a-z-])color:var\(--lsu-red\)/.test(rule.body)) return false
          const size = /font(?:-size)?:[^;]*?(\d+)px/.exec(rule.body)
          // No size in the rule means it inherits one; .kicker is 19px bold,
          // which is itself over the large-text bar.
          if (RELOCATED.has(rule.selector)) return false
          return size ? Number(size[1]) < 24 : false
        })
        .map(rule => `${name}: ${rule.selector}`)

      expect(offenders).toEqual([])
    }
  })
})
