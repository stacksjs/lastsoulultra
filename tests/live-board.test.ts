import type { LiveSnapshot, LiveState } from '../resources/data/live'
import { afterEach, describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import { currentLap, forgetBoard, livePayload, liveSnapshot, secondsToNextLap, standings, stillIn, totalLaps, winner } from '../resources/data/live'

/**
 * The live board, and the shaping behind it.
 *
 * `livePayload` is the one shape the server render and the browser poll both
 * use, so it is the thing that decides what a reader is told during a race.
 * It had no tests. The rules it encodes are not obvious - a backyard ultra
 * ranks on laps completed, two runners on the same lap genuinely share a
 * position, and there is no winner until the board says the race is over.
 */

const LOOP = 6706
const GUN = Date.UTC(2026, 7, 14, 12, 0, 0)

function runner(name: string, laps: number, over: Partial<LiveState['runners'][number]> = {}) {
  return {
    bib: name.slice(0, 2).toUpperCase(),
    name,
    status: 'active' as const,
    lapsCompleted: laps,
    progress: 0.5,
    lastFixAt: GUN,
    progressStale: false,
    ...over,
  }
}

function board(over: Partial<LiveState> = {}): LiveState {
  return {
    generatedAt: GUN,
    raceStartUtc: GUN,
    remaining: 3,
    provisional: false,
    raceOver: false,
    finalLap: null,
    runners: [runner('Ada', 10), runner('Bo', 12), runner('Cy', 10)],
    weatherCelsius: 14,
    sourcesOk: true,
    ...over,
  }
}

function snapshot(state: LiveState | null, over: Partial<LiveSnapshot> = {}): LiveSnapshot {
  return { ok: state !== null, state, fetchedAt: GUN, stale: false, error: null, ...over }
}

describe('an unreachable board', () => {
  it('invents no numbers', () => {
    const payload = livePayload(snapshot(null, { error: 'timeout' }), LOOP)

    expect(payload.ok).toBe(false)
    expect(payload.runners).toEqual([])
    expect(payload.winner).toBeNull()
    expect(payload.starters).toBe(0)
    expect(payload.totalKm).toBe(0)
    expect(payload.error).toBe('timeout')
  })

  it('reports an outage rather than an empty field', () => {
    // A page of zeroes and a field of nobody look the same to a reader; only
    // `ok` tells them apart, so it must survive the shaping.
    expect(livePayload(snapshot(null), LOOP).ok).toBe(false)
    expect(livePayload(snapshot(board({ runners: [runner('Ada', 1)] })), LOOP).ok).toBe(true)
  })
})

describe('ranking the field', () => {
  it('orders on laps, then on progress through the current one', () => {
    const state = board({ runners: [runner('Ada', 10, { progress: 0.1 }), runner('Bo', 10, { progress: 0.9 })] })
    expect(standings(state).map(row => row.name)).toEqual(['Bo', 'Ada'])
  })

  it('gives two runners on the same lap the same position', () => {
    const rows = livePayload(snapshot(board()), LOOP).runners

    expect(rows.map(row => `${row.name} ${row.rank}`)).toEqual(['Bo 1', 'Ada 2', 'Cy 2'])
  })

  it('converts laps to kilometres with the loop it was given', () => {
    const rows = livePayload(snapshot(board()), LOOP).runners
    expect(rows.find(row => row.name === 'Bo')?.km).toBe(80.5)
    expect(livePayload(snapshot(board()), LOOP).totalKm).toBe(Math.round(32 * LOOP / 100) / 10)
  })

  it('counts everyone who is still out there', () => {
    const state = board({ runners: [runner('Ada', 10), runner('Bo', 9, { status: 'out' })] })

    expect(stillIn(state).map(row => row.name)).toEqual(['Ada'])
    expect(totalLaps(state)).toBe(19)
  })
})

describe('calling a winner', () => {
  it('names nobody while the race is running', () => {
    expect(winner(board())).toBeNull()
    expect(livePayload(snapshot(board()), LOOP).winner).toBeNull()
  })

  it('names the last one standing once the board says it is over', () => {
    const state = board({ raceOver: true, finalLap: 12 })
    const payload = livePayload(snapshot(state), LOOP)

    expect(winner(state)?.name).toBe('Bo')
    expect(payload.winner?.name).toBe('Bo')
    expect(payload.finalLap).toBe(12)
  })
})

describe('where the race is up to', () => {
  it('counts the lap from the gun, one an hour', () => {
    expect(currentLap(board(), GUN)).toBe(1)
    expect(currentLap(board(), GUN + 3 * 3600_000 + 60_000)).toBe(4)
    expect(currentLap(board(), GUN - 60_000)).toBe(0)
  })

  it('reports the recorded final lap once it is over, not the clock', () => {
    const over = board({ raceOver: true, finalLap: 94 })
    expect(currentLap(over, GUN + 500 * 3600_000)).toBe(94)
  })

  it('counts down to the next bell, and stops at the end', () => {
    expect(secondsToNextLap(board(), GUN + 59 * 60_000)).toBe(60)
    expect(secondsToNextLap(board({ raceOver: true }), GUN + 60_000)).toBeNull()
    expect(secondsToNextLap(board(), GUN - 60_000)).toBeNull()
  })
})

/**
 * The wiring: /results carries the section, and the server's snapshot is
 * serialised into the client bundle so the board paints on hydration rather
 * than after the first poll.
 */
describe('the board on the results page', () => {
  const realFetch = globalThis.fetch

  /** The worker serves its state as a `window.__LSU__` assignment in HTML. */
  function boardPage(state: Record<string, unknown>): string {
    return `<!doctype html><html><body><script>window.__LSU__ = ${JSON.stringify({ state })};</script></body></html>`
  }

  function stub(body: string | null): void {
    globalThis.fetch = (async () => body === null
      ? new Response('down', { status: 503 })
      : new Response(body, { headers: { 'content-type': 'text/html' } })) as typeof fetch
  }

  async function results(): Promise<string> {
    forgetBoard()
    const path = resolve('resources/views/results.stx')
    return processDirectives(await Bun.file(path).text(), {}, path, {
      enabled: true,
      cache: false,
      componentsDir: resolve('resources/components'),
      layoutsDir: resolve('resources/layouts'),
      partialsDir: resolve('resources/partials'),
    }, new Set())
  }

  afterEach(() => { globalThis.fetch = realFetch; forgetBoard() })

  it('seeds the client with a board that is up', async () => {
    stub(boardPage({ raceStartUtc: GUN, generatedAt: GUN, remaining: 2, runners: [runner('Ada', 10), runner('Bo', 12)] }))
    const html = await results()

    expect(html).toContain('class="live"')
    expect(/boardSeed = \{"ok":true/.test(html)).toBe(true)
    expect(html).toContain('"name":"Bo"')
  })

  it('still carries the section when the board is down, for the poll to fill', async () => {
    // A static build made off-season must not omit the markup, or the board
    // can never appear without a rebuild.
    stub(null)
    const html = await results()

    expect(html).toContain('class="live"')
    expect(/boardSeed = \{"ok":false/.test(html)).toBe(true)
    expect(html).toContain('/api/live')
  })

  it('shows nothing of the board until there is a payload', async () => {
    stub(null)
    const html = await results()

    // The section is gated on the payload, so an outage renders no box.
    expect(html).toMatch(/<section class="live"[^>]*:if="lsuWorthShowing\(\)"/)
  })

  /**
   * The `archived` prop is the only thing stopping the board from repeating a
   * season the page writes out in full below it, and it is a string a human
   * keeps in step with the markup. So the test keeps it in step instead.
   */
  it('tells the board about every season the page archives', async () => {
    const view = await Bun.file(resolve('resources/views/results.stx')).text()
    const sections = [...view.matchAll(/<section id="(\d{4})" class="ed-section">/g)].map(m => m[1])
    const declared = view.match(/<LiveBoard archived="([^"]*)"/)?.[1].split(',').map(y => y.trim()) ?? []

    expect(sections.length).toBeGreaterThan(0)
    expect(declared.sort()).toEqual(sections.sort())
  })

  it('stands down on a season the page already carries', async () => {
    stub(boardPage({
      raceStartUtc: GUN,
      generatedAt: GUN,
      raceOver: true,
      finalLap: 94,
      runners: [runner('Ada', 94, { status: 'out' })],
    }))
    const html = await results()

    // GUN is 2026, which results.stx archives, so the finished board is a
    // thinner copy of the section below it and hides itself.
    expect(/boardArchived = true/.test(html)).toBe(true)
  })

  it('keeps showing a finished race nobody has written up yet', async () => {
    stub(boardPage({
      raceStartUtc: Date.UTC(2031, 7, 14, 12, 0, 0),
      generatedAt: GUN,
      raceOver: true,
      finalLap: 60,
      runners: [runner('Ada', 60, { status: 'out' })],
    }))
    const html = await results()

    expect(/boardArchived = false/.test(html)).toBe(true)
  })
})

/**
 * The shapes the worker actually serves, pinned to a real capture.
 *
 * It renamed its global and renested its payload with no warning and no
 * version marker - `window.__LSU__ = { state }` became
 * `window.__LSU_SUMMARY__ = { summary }`, `lapsCompleted` became `laps`,
 * `finalLap` became `lastLap`, and `active` became `finisher` - and the board
 * simply went quiet, because reading someone's page instead of their API
 * means their refactor is your outage. `tests/fixtures/live-summary.json` is
 * a trimmed copy of what it served on 28 October 2026, so the next rename
 * fails here instead of in production.
 */
describe('the feed shapes the worker serves', () => {
  const realFetch = globalThis.fetch

  afterEach(() => { globalThis.fetch = realFetch; forgetBoard() })

  function serve(body: string): void {
    globalThis.fetch = (async () => new Response(body, { headers: { 'content-type': 'text/html' } })) as typeof fetch
  }

  async function parsed(assignment: string, payload: unknown): Promise<LiveState> {
    forgetBoard()
    serve(`<!doctype html><html><body><script>${assignment}=${JSON.stringify(payload)};</script></body></html>`)
    const snap = await liveSnapshot()
    if (!snap.state)
      throw new Error(snap.error ?? 'the board parsed to nothing')
    return snap.state
  }

  async function capture(): Promise<unknown> {
    return Bun.file(resolve('tests/fixtures/live-summary.json')).json()
  }

  it('reads the summary feed it serves today', async () => {
    const state = await parsed('window.__LSU_SUMMARY__', await capture())

    expect(state.raceOver).toBe(true)
    expect(state.finalLap).toBe(94)
    expect(state.runners).toHaveLength(4)
    expect(totalLaps(state)).toBe(94 + 93 + 80 + 2)
    expect(winner(state)?.name).toBe('Mark Dowdle')
  })

  it('counts the finisher as the one left standing', async () => {
    const state = await parsed('window.__LSU_SUMMARY__', await capture())

    // `finisher` on this feed is `active` on the old one: never knocked out.
    expect(stillIn(state).map(r => r.name)).toEqual(['Mark Dowdle'])
    expect(state.remaining).toBe(1)
  })

  it('still reads the older state feed, in case the worker rolls back', async () => {
    const state = await parsed('window.__LSU__', {
      state: { raceStartUtc: GUN, generatedAt: GUN, raceOver: true, finalLap: 7, runners: [runner('Ada', 7)] },
    })

    expect(state.finalLap).toBe(7)
    expect(winner(state)?.name).toBe('Ada')
  })

  it('treats a status it does not recognise as out', async () => {
    const state = await parsed('window.__LSU_SUMMARY__', {
      summary: {
        raceStartUtc: GUN,
        generatedAt: GUN,
        raceOver: true,
        lastLap: 3,
        runners: [
          { bib: '1', name: 'Ada', laps: 3, status: 'finisher' },
          { bib: '2', name: 'Bo', laps: 3, status: 'withdrawn-appeal-pending' },
        ],
      },
    })

    // Wrong in this direction shows one runner too few, rather than inventing
    // somebody still out on the course.
    expect(stillIn(state).map(r => r.name)).toEqual(['Ada'])
  })

  it('names the markers it looked for when the page carries neither', async () => {
    forgetBoard()
    serve('<!doctype html><html><body>no scoreboard here</body></html>')
    const snap = await liveSnapshot()

    expect(snap.ok).toBe(false)
    expect(snap.error).toContain('window.__LSU_SUMMARY__')
    expect(snap.error).toContain('window.__LSU__')
  })
})
