/**
 * The race, as Last Soul Ultra publishes it.
 *
 * Every figure here is one the organiser states on lastsoulultra.com or in its
 * imprint. Nothing is inferred: a backyard ultra has no predictable distance,
 * duration or finisher count, so the only honest numbers are the format's own
 * constants and the dates on the entry timeline.
 */

export const race = {
  name: 'Last Soul Ultra',
  edition: 'LSU 2.0',
  /** Friday, as the FAQ states it. */
  startsOn: '2026-08-14',
  startsOnLabel: 'friday 14 august 2026',
  /** The field size the organiser selects. */
  fieldSize: 150,
  /** Metres in one loop. 6.7 km, run every full hour. */
  loopMetres: 6700,
  /** 6.7 km in miles, to two places. The site prints "417 miles", a slipped
   *  decimal point; the correct conversion is used here. */
  loopMiles: '4.17',
  entryFeeEur: 100,
  /** Hours a selected athlete has to pay before the code expires. */
  paymentWindowHours: 48,
  crewMax: 3,
  /** Metres square, per athlete, at base camp. */
  campSizeMetres: 3,
  minimumAge: 18,
  email: 'mail@lastsoulultra.com',
  replyWithinHours: 24,
  instagram: 'https://www.instagram.com/lastsoulultra/',
  livestreams: 'https://linktr.ee/lastsoulultra',
  liveResults: 'https://lsu-live.bspmedia.workers.dev/',
  organiser: 'LAST SOUL GmbH',
  managingDirector: 'Kim Gottwald',
  presentedBy: 'Kim Gottwald and rappid.',
} as const

/**
 * The format, in the four rules that define it.
 *
 * A backyard ultra is unusual in that the rules ARE the event: there is no
 * distance to train for and no finish to aim at, so a site that buries them in
 * a paragraph has hidden the only thing a prospective entrant needs.
 */
export interface Rule {
  label: string
  value: string
  detail: string
}

export const rules: Rule[] = [
  {
    label: 'every full hour',
    value: '6.7 km',
    detail: 'One loop, starting on the hour. Finish early and the remainder of the hour is your rest; finish late and you are out.',
  },
  {
    label: 'the start',
    value: 'on the hour',
    detail: 'Every runner starts together from the corral, every hour, for as long as they last.',
  },
  {
    label: 'the finish',
    value: 'there is none',
    detail: 'No distance to complete and no cut-off to beat. The race ends when one runner is left, and that runner must complete a final solo loop to be declared the winner.',
  },
  {
    label: 'elimination',
    value: 'miss one, you are out',
    detail: 'Anyone who fails to complete the loop in the hour, or does not start the next one, is eliminated. There is no partial credit.',
  },
]

/**
 * How a place is won. Four steps, in the order they happen, with the deadline
 * that governs each. The organiser's own wording, condensed to the action.
 */
export interface EntryStep {
  title: string
  detail: string
  deadline?: string
}

export const entrySteps: EntryStep[] = [
  {
    title: 'enter the lottery',
    detail: 'Fill out the form using your real name. One entry per person, and entering is free.',
    deadline: 'registrations collected until 15 february 2026',
  },
  {
    title: 'the field is picked',
    detail: 'Once the lottery closes, the rappid team handpicks 150 athletes from everyone who applied. Every selected athlete is told by email.',
  },
  {
    title: 'pay within 48 hours',
    detail: 'Selected athletes receive a personal registration code. The code is good for 48 hours; miss that window and it expires and the place is reassigned.',
    deadline: `EUR ${race.entryFeeEur} entry fee`,
  },
  {
    title: 'your place is secured',
    detail: 'A final confirmation email follows the payment. There are no refunds, and a place cannot be transferred to somebody else.',
  },
]

/** Who lines up, as the organiser describes the field. */
export const field = 'International ultrarunners, athletes, well-known sports personalities, content creators, and the runners drawn from the lottery.'

/**
 * What state the race is in, derived from the date at render time.
 *
 * This exists because the live site got it wrong: on the day this was written
 * the race was on lap 320 with one runner left, and lastsoulultra.com was
 * still showing "LSU 2.0 is just around the corner" and a closed lottery. Copy
 * typed by hand goes stale the moment the thing it describes moves; copy
 * derived from a date cannot.
 *
 * `running` has no upper bound on purpose. A backyard ultra ends when one
 * runner is left, which may be a day after the start or two weeks after it, so
 * nothing here may assume a duration.
 */
export type RaceState = 'upcoming' | 'running' | 'unknown'

export function raceState(now: Date = new Date()): RaceState {
  const start = new Date(`${race.startsOn}T00:00:00Z`).getTime()
  const elapsed = now.getTime() - start
  if (elapsed < 0) return 'upcoming'
  // No end date is knowable in advance, so once the start has passed the only
  // honest answers are "running" and "we cannot tell from here". The live
  // scoreboard is the authority either way, and every state links to it.
  return 'running'
}

/** Whole days until the start, or null once it has begun. */
export function daysUntilStart(now: Date = new Date()): number | null {
  const start = new Date(`${race.startsOn}T00:00:00Z`).getTime()
  const days = Math.ceil((start - now.getTime()) / 86400000)
  return days > 0 ? days : null
}

/** Whole hours since the gun, which in this format is also the lap number. */
export function hoursSinceStart(now: Date = new Date()): number | null {
  const start = new Date(`${race.startsOn}T00:00:00Z`).getTime()
  const hours = Math.floor((now.getTime() - start) / 3600000)
  return hours >= 0 ? hours : null
}
