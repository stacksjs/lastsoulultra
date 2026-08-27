/**
 * Race photography, published by the organiser on lastsoulultra.com and shot
 * by rappid at the race.
 *
 * Only frames that have actually been looked at appear here, and each alt
 * describes what is in that specific frame. Alt text written from a filename
 * is worse than none: it tells a screen-reader user something confidently
 * wrong, and nobody sighted ever notices.
 *
 * Served from this origin. They used to be hotlinked from the organiser's
 * Squarespace CDN, which sent every visitor's IP to a third party the privacy
 * policy did not name, and made every photograph on the site depend on a host
 * we do not control and cannot cache.
 *
 * The four originals are 1080x1350, so the ladder stops at 1080 - Squarespace
 * happily answered a request for 1600w with the same 1080px file, which is how
 * the site came to believe it had widths it never had. Regenerate with
 * `bun run scripts/photos.ts` (macOS only, uses sips).
 */

export interface Shot {
  /** Slug on disk, not a URL: `<DIR>/<src>-<width>.jpg`. */
  src: string
  alt: string
  /** Roughly how the frame is composed, so a slot can pick one that fits. */
  orientation: 'portrait' | 'landscape'
}

/** Widths on disk. Nothing above 1080 exists, because nothing above 1080 was
 *  ever shot. */
export const WIDTHS = [540, 810, 1080] as const

const DIR = '/assets/images/race'

export const shots = {
  /**
   * The lap board, and the best single image the race has: it states the
   * format in the brand's own red without a word of explanation.
   */
  board: {
    src: 'board',
    alt: 'The race board lit red at dusk, reading 90 souls remaining, 7 laps, 46.9 total km',
    orientation: 'portrait',
  },
  /** A runner caught by the flash against fog, out on the loop after dark. */
  night: {
    src: 'night',
    alt: 'A runner in a pale jacket and rappid. cap lit by a flash against fog and darkness, carrying a soft flask',
    orientation: 'portrait',
  },
  /** The gap between hours, which is the whole tactical problem of the format. */
  refuel: {
    src: 'refuel',
    alt: 'A runner in a rappid. cap eating instant noodles from a cup, resting between laps',
    orientation: 'portrait',
  },
  /** Daylight on the loop, wet road, somewhere in the middle of the race. */
  loop: {
    src: 'loop',
    alt: 'A runner in a black jacket and rappid. cap running back down a wet country road at dawn',
    orientation: 'portrait',
  },
} satisfies Record<string, Shot>

/**
 * The frame at the width a slot actually paints, snapped UP to a width that
 * exists on disk. Asking for something we do not have used to yield a working
 * URL from the CDN; now it would 404, so the snap is what keeps a template
 * free to name the width it wants.
 */
export function at(shot: Shot, width: number): string {
  const w = WIDTHS.find(candidate => candidate >= width) ?? WIDTHS[WIDTHS.length - 1]
  return `${DIR}/${shot.src}-${w}.jpg`
}

/** 1x and 2x, so a retina screen gets the sharp file and a phone does not. */
export function srcset(shot: Shot, width: number): string {
  return `${at(shot, width)} 1x, ${at(shot, width * 2)} 2x`
}

/** The strip on the home page, ordered the way a race night runs. */
export const recap: Shot[] = [shots.board, shots.loop, shots.refuel, shots.night]
