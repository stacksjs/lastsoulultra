/**
 * Race photography, published by the organiser on lastsoulultra.com and shot
 * by rappid at the race.
 *
 * Only frames that have actually been looked at appear here, and each alt
 * describes what is in that specific frame. Alt text written from a filename
 * is worse than none: it tells a screen-reader user something confidently
 * wrong, and nobody sighted ever notices.
 *
 * Served from the organiser's CDN with an explicit width, so a hero does not
 * ship a 2500px original into a 1200px slot.
 */

export interface Shot {
  src: string
  alt: string
  /** Roughly how the frame is composed, so a slot can pick one that fits. */
  orientation: 'portrait' | 'landscape'
}

const CDN = 'https://images.squarespace-cdn.com/content/v1/696e325cc176a32c77c0f287'

export const shots = {
  /**
   * The lap board, and the best single image the race has: it states the
   * format in the brand's own red without a word of explanation.
   */
  board: {
    src: `${CDN}/1e89640e-ec19-4977-a9ed-592e00f3fc75/Last-Soul-Rappid-20.jpg`,
    alt: 'The race board lit red at dusk, reading 90 souls remaining, 7 laps, 46.9 total km',
    orientation: 'portrait',
  },
  /** A runner caught by the flash against fog, out on the loop after dark. */
  night: {
    src: `${CDN}/38de8f46-e113-4aa1-97e7-62821f2f7380/Last-Soul-Rappid-66.jpg`,
    alt: 'A runner in a pale jacket and rappid. cap lit by a flash against fog and darkness, carrying a soft flask',
    orientation: 'portrait',
  },
  /** The gap between hours, which is the whole tactical problem of the format. */
  refuel: {
    src: `${CDN}/06d9b0a6-9a45-405d-adea-0f7f1035d926/Last-Soul-Rappid-59.jpg`,
    alt: 'A runner in a rappid. cap eating instant noodles from a cup, resting between laps',
    orientation: 'portrait',
  },
  /** Daylight on the loop, wet road, somewhere in the middle of the race. */
  loop: {
    src: `${CDN}/2033786b-e332-481e-96dc-5d7da804d354/Last-Soul-Rappid-64.jpg`,
    alt: 'A runner in a black jacket and rappid. cap running back down a wet country road at dawn',
    orientation: 'portrait',
  },
} satisfies Record<string, Shot>

/** The frame at the width a slot actually paints. */
export function at(shot: Shot, width: number): string {
  return `${shot.src}?format=${width}w`
}

/** 1x and 2x, so a retina screen gets the sharp file and a phone does not. */
export function srcset(shot: Shot, width: number): string {
  return `${at(shot, width)} 1x, ${at(shot, Math.min(width * 2, 2500))} 2x`
}

/** The strip on the home page, ordered the way a race night runs. */
export const recap: Shot[] = [shots.board, shots.loop, shots.refuel, shots.night]
