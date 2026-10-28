/**
 * The social share cards, one per page.
 *
 * Nine 1200x630 cards ship under `public/assets/lsu/images/`, produced by the
 * organiser in the brand's own black-and-red: the LSU wordmark top left, a red
 * kicker, a white headline, and `lastsoulultra.com` bottom right over a
 * darkened race photograph. They were captured with the rest of the production
 * assets and then never referenced, so every page in the site shared one
 * portrait WebP of the hero instead - the wrong shape for a card slot that is
 * 1.91:1, and a format several scrapers still decline to render.
 *
 * Mapped here rather than in `production-pages.ts`, which records the captured
 * page metadata as it was found.
 */

export interface ShareCard {
  /** Site-relative path. Absolute URLs are built at render time. */
  src: string
  /**
   * What the card shows AND what it reads. A share card is mostly type, so an
   * alt that describes only the photograph behind it drops the actual message.
   */
  alt: string
}

/** Every card on disk is this size, which is also what the card slot wants. */
export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

const DIR = '/assets/lsu/images'

export const cards = {
  default: {
    src: `${DIR}/og-default.jpg`,
    alt: 'Silhouetted runners against floodlights, captioned "World Series · Season 3 · 2027" and "Three qualifiers. One final."',
  },
  format: {
    src: `${DIR}/og-format.jpg`,
    alt: 'A rain-beaded pair of rappid. sunglasses in close-up, captioned "What a backyard ultra is" and "One loop. Every hour."',
  },
  soulRaces: {
    src: `${DIR}/og-soul-races.jpg`,
    alt: 'Runners and crew waiting in a corral at the start, captioned "Independent backyard ultras" and "Soul Races around the world".',
  },
  sponsorship: {
    src: `${DIR}/og-sponsorship.jpg`,
    alt: 'A runner in a cap and race vest lit from the side in the dark, captioned "Partner with the World Series" and "A race built to be watched".',
  },
  contact: {
    src: `${DIR}/og-contact.jpg`,
    alt: 'A lone runner silhouetted in fog, captioned "We reply within 24 hours" and "Contact & FAQ".',
  },
  lottery: {
    src: `${DIR}/og-lottery.jpg`,
    alt: 'The lap board reading "souls remaining", captioned "Four events · One World Series" and "Enter the lottery".',
  },
  results: {
    src: `${DIR}/og-results.jpg`,
    alt: 'Runners with hands raised under floodlights, captioned "Every edition · Every yard" and "Results".',
  },
  season2025: {
    src: `${DIR}/og-2025.jpg`,
    alt: 'The Last Soul lettering on a dark wall, captioned "Season 1 · 3 October 2025" and "Last Soul 2025".',
  },
  season2026: {
    src: `${DIR}/og-2026.jpg`,
    alt: 'A runner in a headtorch looking straight at the camera at night, captioned "Season 2 · 14 August 2026" and "Last Soul 2026".',
  },
} satisfies Record<string, ShareCard>

/**
 * Path to card. A page with no card of its own gets the default one, which
 * carries the World Series message rather than a page-specific headline.
 */
const byPath: Record<string, ShareCard> = {
  '/': cards.default,
  '/world-series': cards.default,
  '/format': cards.format,
  '/soul-races': cards.soulRaces,
  '/sponsorship': cards.sponsorship,
  '/contact': cards.contact,
  '/faq': cards.contact,
  '/lottery': cards.lottery,
  '/results': cards.results,
  '/results/last-soul-ultra-2025': cards.season2025,
  '/results/last-soul-ultra-2026': cards.season2026,
}

/** The card for a page, falling back to the default for anything unlisted. */
export function shareCard(path: string): ShareCard {
  return byPath[path] ?? cards.default
}
