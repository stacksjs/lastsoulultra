/**
 * Live race data.
 *
 * The race publishes its scoreboard as a Cloudflare Worker
 * (lsu-live.bspmedia.workers.dev, canonically live.lastsoulultra.com). That
 * worker has no JSON endpoint - probing /state, /api/state, /state.json and
 * friends all return 404 - but it server-renders its entire state into a
 * `window.__LSU__` assignment in the HTML it serves. So that is the source:
 * fetch the page, lift the JSON back out, validate it, and cache it.
 *
 * This is the fragile part of the site, and it is fragile on purpose rather
 * than by accident: reading their state directly is what lets the standings
 * live on this site instead of behind an outbound link. If they ever expose a
 * real endpoint, only `readSource` below has to change. Everything downstream
 * already speaks the normalised shape.
 *
 * Every consumer must handle `ok: false`. The page degrades to "the board is
 * unreachable" rather than inventing numbers.
 */

import type { RaceState } from './race'
import { resolveRaceState } from './race'

const SOURCE_URL = 'https://lsu-live.bspmedia.workers.dev/'
const FRESH_MS = 60_000
const STALE_LIMIT_MS = 15 * 60_000
const FETCH_TIMEOUT_MS = 6000
// After a failure, stop hammering a sick upstream. The nav renders on every
// page, so without this a hanging board would put the fetch timeout on the
// critical path of every single request and take the whole site down with it.
const RETRY_AFTER_FAILURE_MS = 30_000

export type RunnerStatus = 'active' | 'out'

export interface LiveRunner {
  bib: string
  name: string
  status: RunnerStatus
  lapsCompleted: number
  /** 0-1 through the current loop, or null when the tracker has no fix. */
  progress: number | null
  lastFixAt: number | null
  progressStale: boolean
}

export interface LiveState {
  generatedAt: number
  raceStartUtc: number
  remaining: number
  provisional: boolean
  raceOver: boolean
  finalLap: number | null
  runners: LiveRunner[]
  weatherCelsius: number | null
  /** Health of the upstream feeds the board itself reports. */
  sourcesOk: boolean
}

export interface LiveSnapshot {
  ok: boolean
  state: LiveState | null
  fetchedAt: number | null
  /** True when we are serving a cached copy older than FRESH_MS. */
  stale: boolean
  error: string | null
}

interface CacheEntry { at: number, state: LiveState }
let cache: CacheEntry | null = null
let inFlight: Promise<LiveSnapshot> | null = null
let failedAt = 0
let lastError: string | null = null

/**
 * Lift the `window.__LSU__ = {...}` object out of the worker's HTML.
 *
 * A non-greedy match up to `</script>` would break the moment the payload
 * contains that string inside a runner's name, so this walks braces instead
 * and tracks string literals and escapes while it does.
 */
function extractStateObject(html: string): unknown {
  const marker = 'window.__LSU__'
  const markerAt = html.indexOf(marker)
  if (markerAt === -1)
    throw new Error('no window.__LSU__ in the source page')

  const start = html.indexOf('{', markerAt)
  if (start === -1)
    throw new Error('no object literal after window.__LSU__')

  let depth = 0
  let inString = false
  let quote = ''
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) inString = false
      continue
    }
    if (ch === '"' || ch === '\'') { inString = true; quote = ch; continue }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0)
        return JSON.parse(html.slice(start, i + 1))
    }
  }
  throw new Error('unterminated object literal after window.__LSU__')
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Narrow the raw payload to the fields this site actually renders, dropping
 * anything malformed. A runner with no bib or no lap count is skipped rather
 * than shown as a blank row.
 */
function normalise(raw: unknown): LiveState {
  const root = raw as Record<string, any>
  const s = root?.state as Record<string, any> | undefined
  if (!s || typeof s !== 'object')
    throw new Error('payload has no state object')

  const raceStartUtc = asNumber(s.raceStartUtc)
  if (raceStartUtc === null)
    throw new Error('payload has no raceStartUtc')

  const rawRunners = Array.isArray(s.runners) ? s.runners : []
  const runners: LiveRunner[] = []
  for (const r of rawRunners) {
    const laps = asNumber(r?.lapsCompleted)
    const bib = typeof r?.bib === 'string' ? r.bib : asNumber(r?.bib)?.toString() ?? null
    const name = typeof r?.name === 'string' ? r.name.trim() : ''
    if (bib === null || !name || laps === null)
      continue
    runners.push({
      bib,
      name,
      status: r.status === 'active' ? 'active' : 'out',
      lapsCompleted: laps,
      progress: asNumber(r?.progress),
      lastFixAt: asNumber(r?.lastFixAt),
      progressStale: r?.progressStale === true,
    })
  }

  if (runners.length === 0)
    throw new Error('payload has no usable runners')

  const sources = s.sources as Record<string, any> | undefined
  const sourcesOk = sources
    ? Object.values(sources).every(v => (v as any)?.ok !== false)
    : true

  return {
    generatedAt: asNumber(s.generatedAt) ?? Date.now(),
    raceStartUtc,
    remaining: asNumber(s.remaining) ?? runners.filter(r => r.status === 'active').length,
    provisional: s.provisional === true,
    raceOver: s.raceOver === true,
    finalLap: asNumber(s.finalLap),
    runners,
    weatherCelsius: asNumber(s.weather?.celsius),
    sourcesOk,
  }
}

async function readSource(): Promise<LiveState> {
  const res = await fetch(SOURCE_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'accept': 'text/html', 'user-agent': 'lastsoulultra.com (live board mirror)' },
  })
  if (!res.ok)
    throw new Error(`source responded ${res.status}`)
  return normalise(extractStateObject(await res.text()))
}

function snapshotFromCache(error: string | null): LiveSnapshot {
  if (!cache)
    return { ok: false, state: null, fetchedAt: null, stale: false, error }
  const age = Date.now() - cache.at
  // A cached board that is quarter of an hour old is worse than saying
  // nothing: during a live race the standings would be several laps behind.
  if (age > STALE_LIMIT_MS)
    return { ok: false, state: null, fetchedAt: cache.at, stale: true, error }
  return { ok: true, state: cache.state, fetchedAt: cache.at, stale: age > FRESH_MS, error }
}

/**
 * Current board state, cached for a minute. Concurrent callers share one
 * request rather than each opening their own.
 */
export async function liveSnapshot(): Promise<LiveSnapshot> {
  if (cache && Date.now() - cache.at < FRESH_MS)
    return { ok: true, state: cache.state, fetchedAt: cache.at, stale: false, error: null }

  // Still inside the backoff window from a recent failure: serve what we have
  // rather than paying the timeout again.
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_FAILURE_MS)
    return snapshotFromCache(lastError)

  if (inFlight)
    return inFlight

  inFlight = (async (): Promise<LiveSnapshot> => {
    try {
      const state = await readSource()
      cache = { at: Date.now(), state }
      failedAt = 0
      lastError = null
      return { ok: true, state, fetchedAt: cache.at, stale: false, error: null }
    }
    catch (error) {
      // Fall back to the last good copy so one blip does not blank the page.
      failedAt = Date.now()
      lastError = error instanceof Error ? error.message : 'unknown error'
      return snapshotFromCache(lastError)
    }
    finally {
      inFlight = null
    }
  })()

  return inFlight
}

/* ---------------------------------------------------------------------- */
/* Derived views                                                           */
/* ---------------------------------------------------------------------- */

/** Laps first, then how far through the current loop. Nulls sort last. */
export function standings(state: LiveState): LiveRunner[] {
  return [...state.runners].sort((a, b) =>
    b.lapsCompleted - a.lapsCompleted || (b.progress ?? -1) - (a.progress ?? -1) || a.name.localeCompare(b.name))
}

export function stillIn(state: LiveState): LiveRunner[] {
  return standings(state).filter(r => r.status === 'active')
}

/**
 * The last runner standing, which only exists once the board says the race is
 * over. Before that the leader is just the leader, and calling them the winner
 * would be wrong by a lap.
 */
export function winner(state: LiveState): LiveRunner | null {
  if (!state.raceOver)
    return null
  return stillIn(state)[0] ?? standings(state)[0] ?? null
}

export function totalLaps(state: LiveState): number {
  return state.runners.reduce((sum, r) => sum + r.lapsCompleted, 0)
}

/**
 * Which lap the field is on, counted from the gun. One lap starts every hour,
 * so this is elapsed hours plus one while the race runs, and the recorded
 * final lap once it is over.
 */
export function currentLap(state: LiveState, now: number = Date.now()): number {
  if (state.raceOver)
    return state.finalLap ?? Math.max(...state.runners.map(r => r.lapsCompleted), 0)
  const elapsed = now - state.raceStartUtc
  if (elapsed < 0)
    return 0
  return Math.floor(elapsed / 3_600_000) + 1
}

/** Seconds until the next lap starts on the hour, or null when not running. */
export function secondsToNextLap(state: LiveState, now: number = Date.now()): number | null {
  if (state.raceOver || now < state.raceStartUtc)
    return null
  const sinceStart = now - state.raceStartUtc
  return Math.ceil((3_600_000 - (sinceStart % 3_600_000)) / 1000)
}

/* ---------------------------------------------------------------------- */
/* Wire shape                                                              */
/* ---------------------------------------------------------------------- */

export interface LiveRow {
  rank: number
  bib: string
  name: string
  status: RunnerStatus
  laps: number
  km: number
  progress: number | null
  stale: boolean
}

export interface LivePayload {
  ok: boolean
  stale: boolean
  error: string | null
  fetchedAt: number | null
  raceOver: boolean
  provisional: boolean
  finalLap: number | null
  remaining: number
  currentLap: number
  secondsToNextLap: number | null
  totalLaps: number
  totalKm: number
  starters: number
  weatherCelsius: number | null
  sourcesOk: boolean
  winner: LiveRow | null
  runners: LiveRow[]
}

/**
 * One shape for both the server render and the browser poll, so the table
 * cannot drift between the two. Ranking is done here rather than in the
 * template: a backyard ultra ranks on laps completed, and two runners on the
 * same lap genuinely share a position.
 */
export function livePayload(snapshot: LiveSnapshot, loopMetres: number, now: number = Date.now()): LivePayload {
  const base = {
    ok: snapshot.ok,
    stale: snapshot.stale,
    error: snapshot.error,
    fetchedAt: snapshot.fetchedAt,
  }
  const s = snapshot.state
  if (!snapshot.ok || !s) {
    return {
      ...base,
      ok: false,
      raceOver: false,
      provisional: false,
      finalLap: null,
      remaining: 0,
      currentLap: 0,
      secondsToNextLap: null,
      totalLaps: 0,
      totalKm: 0,
      starters: 0,
      weatherCelsius: null,
      sourcesOk: false,
      winner: null,
      runners: [],
    }
  }

  const ordered = standings(s)
  const km = (laps: number) => Math.round(laps * loopMetres / 100) / 10

  let rank = 0
  let lastLaps: number | null = null
  const runners: LiveRow[] = ordered.map((r, index) => {
    if (r.lapsCompleted !== lastLaps) {
      rank = index + 1
      lastLaps = r.lapsCompleted
    }
    return {
      rank,
      bib: r.bib,
      name: r.name,
      status: r.status,
      laps: r.lapsCompleted,
      km: km(r.lapsCompleted),
      progress: r.progress,
      stale: r.progressStale,
    }
  })

  const champion = winner(s)
  const laps = totalLaps(s)

  return {
    ...base,
    raceOver: s.raceOver,
    provisional: s.provisional,
    finalLap: s.finalLap,
    remaining: s.remaining,
    currentLap: currentLap(s, now),
    secondsToNextLap: secondsToNextLap(s, now),
    totalLaps: laps,
    totalKm: km(laps),
    starters: s.runners.length,
    weatherCelsius: s.weatherCelsius,
    sourcesOk: s.sourcesOk,
    winner: champion ? runners.find(r => r.bib === champion.bib) ?? null : null,
    runners,
  }
}

/**
 * The site-wide race state, preferring the board over the calendar.
 *
 * Every surface that says "running now" has to agree with the standings page,
 * and only the board knows the race has ended - the calendar never will,
 * because a backyard ultra has no scheduled finish. Cached with the snapshot,
 * so calling this from the nav on every request costs nothing.
 */
export async function liveRaceState(): Promise<RaceState> {
  const snapshot = await liveSnapshot()
  return resolveRaceState(snapshot.ok && snapshot.state ? { raceOver: snapshot.state.raceOver } : null)
}
