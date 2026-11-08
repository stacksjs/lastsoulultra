/**
 * The Season 2 race board on the home page.
 *
 * When the board scrolls into view it plays the 94 hours of Season 2 through
 * once: the clock runs, the field thins, and at eight moments the copy beside
 * the board swaps to what happened at that hour. The tick strip under the
 * readouts is the field itself, one tick per starter, and dragging across it
 * scrubs to the hour that many runners were still in.
 *
 * Pure timing and readout maths live here so the template keeps state and
 * lifecycle; the one DOM adapter, drawAttrition, takes the canvas it paints.
 */

export const RACE_YARDS = 94
export const RACE_STARTERS = 160
const LOOP_KM = 6.706

export interface RaceCard {
  /** The yard this moment happened on. */
  yard: number
  /** Label under the readouts. */
  time: string
  /** Heading, as two lines. */
  heading: [string, string]
  body: string
}

/** What happened, hour by hour, in Season 2 (14 to 18 August 2026). */
export const raceCards: RaceCard[] = [
  { yard: 1, time: 'hour 1', heading: ['160 souls', 'start'], body: 'Friday 14 August, 2026. The whole field lines up in the corral for the first 6.7 km loop. Everyone has sixty minutes to come back.' },
  { yard: 30, time: 'hour 30', heading: ['Egan\'s', '30th yard'], body: 'Mike Egan, a former US Marine who lost both legs in Afghanistan, completes 30 yards in a wheelchair before failing to finish yard 31.' },
  { yard: 52, time: 'hour 52', heading: ['Last woman', 'standing'], body: 'Caroline Maria Bolte stops after 52 yards and 348 km, a German women\'s backyard record, set in the first backyard ultra she ever entered.' },
  { yard: 68, time: 'hour 68', heading: ['Past last', 'year\'s race'], body: 'Hendrik Boury goes out on Monday morning at 68 yards. The 2025 edition ended at 67. Everything from here is new ground.' },
  { yard: 80, time: 'hour 80', heading: ['Two', 'left'], body: 'Norman Mascher-Aspensjö is out at 80 yards. Mark Dowdle and Ayyoub \'Ello\' El Osrouti keep starting on the hour, alone together.' },
  { yard: 87, time: 'hour 87', heading: ['The fastest', 'yard'], body: 'Dowdle runs his quickest loop of the race on yard 87: 38:15, against a 51:42 average, shadowing Ello stride for stride on the thermal cameras. Neither man will lead.' },
  { yard: 91, time: 'hour 91', heading: ['A German', 'record falls'], body: 'No backyard ultra on German soil had ever gone past 90 yards. The two of them run through 91 side by side on the fourth night.' },
  { yard: 94, time: 'the end', heading: ['One final', 'solo lap'], body: 'Ello El Osrouti starts yard 94 and does not make it back, credited with 93. Mark Dowdle finishes it alone on Tuesday morning. 630 km, four days, one last soul.' },
]

/** The line under the season-against-season bars, by how far the race has got. */
export function duelCaption(yards: number): string {
  if (yards < 30) return 'Scroll. Both fields set off together, hour by hour.'
  if (yards <= 67) return 'Season 1 ran through two nights. Kim Gottwald and Ello El Osrouti carried it to 67 yards, 449.3 km.'
  if (yards < 91) return 'Season 1 is over. Season 2 keeps going. Everything from yard 68 is new ground for the race.'
  return 'Yards 91 to 94: past the old German-soil mark of 90, further than any backyard on German ground had ever gone.'
}

/* Playback: the hours between cards run in RUN_MS for the whole race, eased
   into each card, and every card then holds for HOLD_MS while the last fifth
   of an hour ticks over, so the reader has time to take it in. */
const RUN_MS = 6000
const HOLD_MS = 2600
const LEAD_IN = 0.2

interface Span { ms: number, from: number, to: number, card: number, ease?: boolean }

export interface RaceTimeline { spans: Span[], total: number }

export function raceTimeline(cards: RaceCard[] = raceCards): RaceTimeline {
  const spans: Span[] = []
  let at = 0
  cards.forEach((card, index) => {
    const yard = Math.min(RACE_YARDS, card.yard)
    const lead = Math.min(LEAD_IN, Math.max(0, yard - at))
    const arrive = yard - lead
    const run = (arrive - at) / RACE_YARDS * RUN_MS
    if (arrive > at) spans.push({ ms: index === 0 ? Math.max(HOLD_MS, run) : run, from: at, to: arrive, card: index - 1, ease: true })
    spans.push({ ms: HOLD_MS, from: arrive, to: yard, card: index })
    at = yard
  })
  if (at < RACE_YARDS) spans.push({ ms: (RACE_YARDS - at) / RACE_YARDS * RUN_MS, from: at, to: RACE_YARDS, card: cards.length - 1 })
  return { spans, total: spans.reduce((sum, span) => sum + span.ms, 0) }
}

/** Hours elapsed and the card showing, `ms` into playback. A card of -1 is the opening copy. */
export function raceAt(timeline: RaceTimeline, ms: number): { hours: number, card: number } {
  let left = ms
  for (const span of timeline.spans) {
    if (left < span.ms) {
      let t = left / span.ms
      if (span.ease) t = 1 - (1 - t) * (1 - t)
      return { hours: span.from + (span.to - span.from) * t, card: span.card }
    }
    left -= span.ms
  }
  return { hours: RACE_YARDS, card: raceCards.length - 1 }
}

/** The playback position that shows `hours`, so a scrub can hand back to the clock. */
export function raceMs(timeline: RaceTimeline, hours: number): number {
  let elapsed = 0
  for (const span of timeline.spans) {
    if (hours <= span.to) {
      const t = Math.max(0, Math.min(1, (hours - span.from) / (span.to - span.from || 1)))
      return elapsed + (span.ease ? 1 - Math.sqrt(1 - t) : t) * span.ms
    }
    elapsed += span.ms
  }
  return timeline.total
}

const pad = (value: number, size = 2): string => String(value).padStart(size, '0')

export interface RaceReadout { lap: string, clock: string, souls: number, soulsText: string, km: string }

/**
 * The board at a moment. The field thins geometrically from 160 to the last
 * two over 92 hours, which tracks the real Season 2 attrition closely, and
 * the last soul stands alone for the final half hour.
 */
export function raceReadout(hours: number): RaceReadout {
  const seconds = Math.min(RACE_YARDS * 3600, Math.max(0, Math.floor(hours * 3600)))
  const clock = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds % 3600 / 60))}:${pad(seconds % 60)}`
  const h = Math.max(1, seconds / 3600)
  const souls = h >= 93.5 ? 1 : Math.max(2, Math.round(RACE_STARTERS * (2 / RACE_STARTERS) ** ((h - 1) / 92)))
  return {
    lap: seconds <= 0 ? '00' : pad(Math.min(RACE_YARDS, Math.ceil(seconds / 3600))),
    clock,
    souls,
    soulsText: pad(souls, 3),
    km: (seconds / 3600 * LOOP_KM).toFixed(1).padStart(5, '0'),
  }
}

/** The hour at which `souls` runners were still in, the inverse of raceReadout. */
export function hoursForSouls(souls: number): number {
  return souls <= 1 ? RACE_YARDS : 1 + 92 * Math.log(souls / RACE_STARTERS) / Math.log(2 / RACE_STARTERS)
}

/** Souls remaining under a pointer at `clientX` across the strip. */
export function soulsAtPointer(canvas: HTMLCanvasElement | null, clientX: number): number {
  if (!canvas) return RACE_STARTERS
  const box = canvas.getBoundingClientRect()
  const tick = Math.min(RACE_STARTERS - 1, Math.max(0, Math.floor((clientX - box.left) / (box.width || 1) * RACE_STARTERS)))
  return RACE_STARTERS - tick
}

/** One tick per starter: red for every runner already out, white for the souls still in. */
export function drawAttrition(canvas: HTMLCanvasElement | null, souls: number): void {
  if (!canvas) return
  const width = canvas.offsetWidth || 650
  const height = canvas.offsetHeight || 44
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, width, height)
  const step = width / RACE_STARTERS
  const out = RACE_STARTERS - souls
  for (let tick = 0; tick < RACE_STARTERS; tick++) {
    context.fillStyle = tick < out ? 'rgba(255,42,26,0.8)' : 'rgba(255,255,255,0.88)'
    context.fillRect(tick * step, 0, Math.max(1, step - 1.4), height)
  }
  if (souls === 1) {
    context.textAlign = 'right'
    context.font = '600 11px Barlow, sans-serif'
    context.fillStyle = 'rgba(255,255,255,0.95)'
    context.fillText('DOWDLE', width - step - 8, height / 2 + 4)
  }
}
