import type { EventsPayload, RaceEvent } from '../resources/data/race-events'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { entryHeading, entryKicker, entryRows, entryRowsByStop, entryStatus, eventWhen, forgetEvents, parseEvent, raceEvents } from '../resources/data/race-events'

/**
 * The entry windows.
 *
 * These were hand-written markup - "Entry requests open" under the USA,
 * "Coming soon" under the rest - which is true the day it is typed and false
 * afterwards with nothing failing. The service owns the phase; this suite
 * pins what the page does with it.
 */

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)

function event(over: Partial<RaceEvent> = {}): RaceEvent {
  return {
    slug: 'lsu-2027-uk',
    name: 'United Kingdom',
    country: 'GBR',
    edition: '4.0',
    season: 3,
    phase: 'upcoming',
    isFinal: false,
    plannedYear: 2027,
    plannedMonth: 4,
    timezone: 'Europe/London',
    opensAt: Date.UTC(2026, 9, 31, 23, 0, 0),
    closesAt: null,
    ...over,
  }
}

function payload(upcoming: RaceEvent[]): EventsPayload {
  return { ok: true, error: null, fetchedAt: NOW, stale: false, upcoming, past: [] }
}

describe('reading one event', () => {
  it('narrows the service row to what the page renders', () => {
    const parsed = parseEvent({
      slug: 'lsu-2027-uk', name: 'United Kingdom', country: 'GBR', edition: '4.0', season: 3,
      phase: 'upcoming', is_final: false, planned_year: 2027, planned_month: 4,
      timezone: 'Europe/London', applications_open_at: '2026-10-31T23:00:00+00:00',
    })

    expect(parsed?.name).toBe('United Kingdom')
    expect(parsed?.phase).toBe('upcoming')
    expect(parsed?.opensAt).toBe(Date.UTC(2026, 9, 31, 23, 0, 0))
  })

  it('drops a row it cannot render rather than showing a blank card', () => {
    expect(parseEvent({ name: 'No slug', phase: 'open' })).toBeNull()
    expect(parseEvent({ slug: 'a', phase: 'open' })).toBeNull()
    expect(parseEvent({ slug: 'a', name: 'b' })).toBeNull()
    expect(parseEvent({ slug: 'a', name: 'b', phase: 'something-new' })).toBeNull()
    expect(parseEvent(null)).toBeNull()
  })
})

describe('what to say under an event', () => {
  it('follows the service, not the page clock', () => {
    // The service owns the phase. A page that decided for itself from a date
    // would disagree with the form the entry actually posts to.
    expect(entryStatus(event({ phase: 'open' }), NOW).open).toBe(true)
    expect(entryStatus(event({ phase: 'open' }), NOW + 400 * 86400_000).open).toBe(true)
  })

  it('names the day a window opens, in the host country time', () => {
    // Australia opens 10:00 on 1 December in Sydney, which is 30 November in
    // UTC - formatting in UTC tells an Australian the wrong day.
    const aus = event({ name: 'AUSTRALIA x DCG', timezone: 'Australia/Sydney', opensAt: Date.UTC(2026, 10, 30, 23, 0, 0) })
    expect(entryStatus(aus, NOW).label).toBe('Entries open 1 December')

    const uk = event({ timezone: 'Europe/London' })
    expect(entryStatus(uk, NOW).label).toBe('Entries open 31 October')
  })

  it('falls back when the service sets no window', () => {
    expect(entryStatus(event({ opensAt: null }), NOW).label).toBe('Coming soon')
    // Already past, but the service has not flipped the phase yet.
    expect(entryStatus(event({ opensAt: NOW - 86400_000 }), NOW).label).toBe('Coming soon')
  })

  it('says why the final is not open, rather than that it is closed', () => {
    const final = event({ name: 'Germany', isFinal: true, phase: 'closed' })

    expect(entryStatus(final, NOW)).toEqual({ label: 'Qualification only', open: false })
  })

  it('covers the other phases', () => {
    expect(entryStatus(event({ phase: 'closed' }), NOW).label).toBe('Entries closed')
    expect(entryStatus(event({ phase: 'final' }), NOW).label).toBe('Finished')
  })

  it('survives a timezone the service invents', () => {
    const odd = event({ timezone: 'Mars/Olympus' })
    expect(entryStatus(odd, NOW).label).toContain('Entries open')
  })
})

describe('the page copy', () => {
  it('dates an event, or gives the year alone', () => {
    expect(eventWhen(event())).toBe('April 2027')
    expect(eventWhen(event({ plannedMonth: null }))).toBe('2027')
    expect(eventWhen(event({ plannedYear: null }))).toBe('')
  })

  it('heads the section from whatever season is being advertised', () => {
    expect(entryHeading(payload([event()]))).toBe('Season 3 / 2027 entries')
    expect(entryHeading(payload([]))).toBe('')
  })

  it('names the open event in the kicker', () => {
    const open = event({ name: 'USA', phase: 'open' })
    expect(entryKicker(payload([open, event()]), NOW)).toBe('Season 3 / USA entries open')
  })

  it('names the next one when none is open yet', () => {
    expect(entryKicker(payload([event()]), NOW)).toBe('Season 3 / United Kingdom entries open 31 October')
  })

  it('claims no window when there is none', () => {
    const closed = event({ phase: 'closed', opensAt: null })
    expect(entryKicker(payload([closed]), NOW)).toBe('Season 3')
    expect(entryKicker(payload([]), NOW)).toBe('')
  })

  it('shapes one row per event, for the server and the browser alike', () => {
    const rows = entryRows(payload([event({ name: 'USA', phase: 'open' }), event({ isFinal: true })]), NOW)

    expect(rows.map(row => row.label)).toEqual(['Entry requests open', 'Qualification only'])
    expect(rows[0]!.open).toBe(true)
    expect(rows[1]!.isFinal).toBe(true)
  })
})

describe('when the service is unreachable', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => forgetEvents())
  afterEach(() => { globalThis.fetch = realFetch; forgetEvents() })

  it('invents no events', async () => {
    globalThis.fetch = (async () => new Response('down', { status: 503 })) as typeof fetch
    const result = await raceEvents()

    expect(result.ok).toBe(false)
    expect(result.upcoming).toEqual([])
    expect(entryRows(result)).toEqual([])
    expect(entryKicker(result)).toBe('')
  })

  it('treats a response with nothing usable as an outage', async () => {
    globalThis.fetch = (async () => Response.json({ upcoming: [{ name: 'no slug' }], past: [] })) as typeof fetch
    expect((await raceEvents()).ok).toBe(false)
  })

  it('asks once for a whole render', async () => {
    let hits = 0
    globalThis.fetch = (async () => { hits += 1; return Response.json({ upcoming: [{ slug: 'a', name: 'A', phase: 'open' }], past: [] }) }) as typeof fetch

    await Promise.all([raceEvents(), raceEvents(), raceEvents()])
    expect(hits).toBe(1)
  })
})

describe('keying the four World Series stops', () => {
  it('maps each country onto the stop the globe pins use', () => {
    const stops = entryRowsByStop(payload([
      event({ name: 'USA', country: 'USA', phase: 'open' }),
      event({ name: 'United Kingdom', country: 'GBR' }),
      event({ name: 'AUSTRALIA x DCG', country: 'AUS' }),
      event({ name: 'Germany', country: 'GER', isFinal: true, phase: 'closed' }),
    ]), NOW)

    expect(Object.keys(stops).sort()).toEqual(['aus', 'ger', 'uk', 'usa'])
    expect(stops.usa!.open).toBe(true)
    expect(stops.ger!.isFinal).toBe(true)
    expect(stops.uk!.label).toBe('Entries open 31 October')
  })

  it('leaves out a country the page has no stop for', () => {
    // A fifth qualifier would need markup and a pin before it can be keyed.
    const stops = entryRowsByStop(payload([event({ name: 'Japan', country: 'JPN' })]), NOW)
    expect(stops).toEqual({})
  })

  it('is empty when the service is unreachable, so the page says nothing', () => {
    const down = { ok: false, error: 'timeout', fetchedAt: null, stale: false, upcoming: [], past: [] }
    expect(entryRowsByStop(down, NOW)).toEqual({})
  })
})
