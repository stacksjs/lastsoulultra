/**
 * The season's events, from the race service that owns them.
 *
 * The entry pages used to state each event's status in hand-written markup:
 * "Entry requests open" under the USA, "Coming soon" under the other three.
 * That is true on the day it is typed and false afterwards without anything
 * failing - the USA window closes on 1 November 2026 and the UK opens on 31
 * October, so the two pages whose whole job is taking entries would have
 * been wrong about both within a week of each other.
 *
 * `https://api.lastsoulultra.com/v1/events` is the same service the entry
 * form already posts to, and this part of it needs no session. Read it,
 * narrow it to what the pages render, and let the copy follow.
 *
 * Every consumer must handle `ok: false`. A page that cannot reach the
 * service says nothing about a window rather than guessing at one.
 */

const SOURCE_URL = 'https://api.lastsoulultra.com/v1/events'
const FRESH_MS = 300_000
const STALE_LIMIT_MS = 6 * 3600_000
const FETCH_TIMEOUT_MS = 6000
/** After a failure, stop asking a sick service on every render. */
const RETRY_AFTER_FAILURE_MS = 60_000

/** Where an event is in its entry cycle, as the service reports it. */
export type EventPhase = 'open' | 'upcoming' | 'closed' | 'final'

export interface RaceEvent {
  slug: string
  name: string
  /** Three-letter code: USA, GBR, AUS, GER. The pages key on this. */
  country: string
  edition: string
  season: number | null
  phase: EventPhase
  /** The final is reached by qualifying, not by entering a draw. */
  isFinal: boolean
  plannedYear: number | null
  plannedMonth: number | null
  /** IANA zone of the host country, so a window reads as the organiser says it. */
  timezone: string | null
  /** Epoch millis, or null when the service has not set a window. */
  opensAt: number | null
  closesAt: number | null
}

export interface EventsPayload {
  ok: boolean
  error: string | null
  fetchedAt: number | null
  stale: boolean
  upcoming: RaceEvent[]
  past: RaceEvent[]
}

function text(value: unknown, max = 120): string | null {
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** An ISO timestamp as epoch millis, or null. */
function instant(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const at = Date.parse(value)
  return Number.isFinite(at) ? at : null
}

const PHASES: EventPhase[] = ['open', 'upcoming', 'closed', 'final']

/**
 * One event, narrowed. A row missing a slug, a name or a phase this site
 * understands is dropped rather than rendered as a blank card.
 */
export function parseEvent(raw: unknown): RaceEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, any>

  const slug = text(row.slug, 140)
  const name = text(row.name, 80)
  const phase = PHASES.includes(row.phase) ? row.phase as EventPhase : null
  if (!slug || !name || !phase) return null

  return {
    slug,
    name,
    country: text(row.country, 3) ?? '',
    edition: text(row.edition, 16) ?? '',
    season: count(row.season),
    phase,
    isFinal: row.is_final === true,
    plannedYear: count(row.planned_year),
    plannedMonth: count(row.planned_month),
    timezone: text(row.timezone, 64),
    opensAt: instant(row.applications_open_at),
    closesAt: instant(row.applications_close_at),
  }
}

interface CacheEntry { at: number, upcoming: RaceEvent[], past: RaceEvent[] }
let cache: CacheEntry | null = null
let inFlight: Promise<EventsPayload> | null = null
let failedAt = 0
let lastError: string | null = null

async function read(): Promise<CacheEntry> {
  const response = await fetch(SOURCE_URL, {
    headers: { 'accept': 'application/json', 'user-agent': 'lastsoulultra.com (entry pages)' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`events responded ${response.status}`)

  const body = await response.json() as Record<string, unknown>
  const narrow = (list: unknown): RaceEvent[] =>
    (Array.isArray(list) ? list : []).map(parseEvent).filter((row): row is RaceEvent => row !== null)

  const upcoming = narrow(body.upcoming)
  const past = narrow(body.past)
  if (upcoming.length === 0 && past.length === 0) throw new Error('no usable events in the response')
  return { at: Date.now(), upcoming, past }
}

function fromCache(error: string | null): EventsPayload {
  if (!cache) return { ok: false, error, fetchedAt: null, stale: false, upcoming: [], past: [] }
  const age = Date.now() - cache.at
  // A window that closed hours ago is worse than saying nothing.
  if (age > STALE_LIMIT_MS) return { ok: false, error, fetchedAt: cache.at, stale: true, upcoming: [], past: [] }
  return { ok: true, error, fetchedAt: cache.at, stale: age > FRESH_MS, upcoming: cache.upcoming, past: cache.past }
}

/** The season's events, cached. Concurrent callers share one request. */
export async function raceEvents(): Promise<EventsPayload> {
  if (cache && Date.now() - cache.at < FRESH_MS)
    return { ok: true, error: null, fetchedAt: cache.at, stale: false, upcoming: cache.upcoming, past: cache.past }

  if (failedAt && Date.now() - failedAt < RETRY_AFTER_FAILURE_MS)
    return fromCache(lastError)

  if (inFlight) return inFlight

  inFlight = (async (): Promise<EventsPayload> => {
    try {
      cache = await read()
      failedAt = 0
      lastError = null
      return { ok: true, error: null, fetchedAt: cache.at, stale: false, upcoming: cache.upcoming, past: cache.past }
    }
    catch (error) {
      failedAt = Date.now()
      lastError = error instanceof Error ? error.message : 'unknown error'
      return fromCache(lastError)
    }
    finally {
      inFlight = null
    }
  })()

  return inFlight
}

/** For tests, and for a dev server that should not hold a stale season. */
export function forgetEvents(): void {
  cache = null
  inFlight = null
  failedAt = 0
  lastError = null
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "February 2027", or "2027" when only the year is known. */
export function eventWhen(event: RaceEvent): string {
  if (!event.plannedYear) return ''
  const month = event.plannedMonth ? MONTHS[event.plannedMonth - 1] : null
  return month ? `${month} ${event.plannedYear}` : String(event.plannedYear)
}

/**
 * The day a window opens, in the host country's own zone.
 *
 * Australia's opens at 10:00 on 1 December in Sydney, which is 23:00 on 30
 * November in UTC - so formatting in UTC tells an Australian reader the
 * wrong day for their own race.
 */
function openingDay(event: RaceEvent): string {
  const when = new Date(event.opensAt!)
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: event.timezone ?? 'UTC' }).format(when)
  }
  catch {
    // An unknown zone from the service is not a reason to print nothing.
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(when)
  }
}

export interface EntryStatus {
  label: string
  /** True only while the service is actually accepting requests. */
  open: boolean
}

/**
 * What to say under an event.
 *
 * The final is the one case the phase alone does not cover: it is reached by
 * qualifying through the other three, so "entries closed" would be wrong
 * about why.
 */
export function entryStatus(event: RaceEvent, now: number = Date.now()): EntryStatus {
  if (event.isFinal) return { label: 'Qualification only', open: false }

  switch (event.phase) {
    case 'open':
      return { label: 'Entry requests open', open: true }
    case 'upcoming':
      if (event.opensAt && event.opensAt > now)
        return { label: `Entries open ${openingDay(event)}`, open: false }
      return { label: 'Coming soon', open: false }
    case 'closed':
      return { label: 'Entries closed', open: false }
    case 'final':
      return { label: 'Finished', open: false }
  }
}

export interface EntryRow {
  slug: string
  name: string
  /** "February 2027", or the year alone when the month is not set. */
  when: string
  label: string
  open: boolean
  isFinal: boolean
}

/**
 * One row per upcoming event, shaped the way the entry page prints it.
 *
 * Exported so the server render and the browser poll share it rather than
 * each deciding separately what "Coming soon" means - the same reason
 * livePayload exists for the scoreboard.
 */
export function entryRows(payload: EventsPayload, now: number = Date.now()): EntryRow[] {
  return payload.upcoming.map(event => ({
    slug: event.slug,
    name: event.name,
    when: eventWhen(event),
    isFinal: event.isFinal,
    ...entryStatus(event, now),
  }))
}

/** "Season 3 / 2027 entries", from whatever the service is advertising. */
export function entryHeading(payload: EventsPayload): string {
  const season = payload.upcoming.find(event => event.season)?.season
  const year = payload.upcoming.find(event => event.plannedYear)?.plannedYear
  return season && year ? `Season ${season} / ${year} entries` : ''
}

/**
 * The line above the heading on the entry page.
 *
 * It named one country and one state - "Season 3 / USA entries open" - which
 * stops being true the day that window closes. It now says whichever event
 * is actually open, or the next one to open, and falls back to the season
 * alone rather than claiming a window that is not there.
 */
export function entryKicker(payload: EventsPayload, now: number = Date.now()): string {
  const season = payload.upcoming.find(event => event.season)?.season
  const prefix = season ? `Season ${season}` : ''

  const open = payload.upcoming.find(event => entryStatus(event, now).open)
  if (open) return prefix ? `${prefix} / ${open.name} entries open` : `${open.name} entries open`

  const next = payload.upcoming
    .filter(event => !event.isFinal && event.opensAt && event.opensAt > now)
    .sort((a, b) => a.opensAt! - b.opensAt!)[0]
  if (next) {
    // Only the leading word is lowered, or "31 October" comes out as a month
    // nobody writes that way.
    const label = entryStatus(next, now).label
    const joined = `${next.name} ${label.charAt(0).toLowerCase()}${label.slice(1)}`
    return prefix ? `${prefix} / ${joined}` : joined
  }

  return prefix
}
