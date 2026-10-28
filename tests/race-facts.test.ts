import { describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'

/**
 * The results pages state figures that are derived from the race database in
 * resources/data/results-<year>.json. The README's one content rule is that
 * race facts are not replaced with sample content; this is what checks it.
 *
 * Everything here is recomputed from the JSON and then looked for in the
 * rendered page, so a page that drifts from its own source fails, and so
 * does a page whose numbers were edited by hand.
 */

interface Row { name: string, yards: number, status: string }

async function season(year: number) {
  const data = await Bun.file(`resources/data/results-${year}.json`).json()
  const rows: Row[] = data.results
  const ordered = [...rows].sort((a, b) => b.yards - a.yards)
  const loopMetres: number = data.event.loop_metres
  const winner = ordered[0]!

  return {
    date: data.event.start_date as string,
    started: data.totals.started as number,
    loopMetres,
    winner,
    assist: ordered[1]!,
    third: ordered[2]!,
    kilometres: Math.round(winner.yards * loopMetres / 100) / 10,
    /** A yard an hour, so the whole days the race ran for. */
    days: Math.ceil(winner.yards / 24),
  }
}

const page = await (async () => {
  const path = resolve('resources/views/results.stx')
  return processDirectives(await Bun.file(path).text(), {}, path, {
    enabled: true,
    cache: false,
    componentsDir: resolve('resources/components'),
    layoutsDir: resolve('resources/layouts'),
    partialsDir: resolve('resources/partials'),
  }, new Set())
})()

/**
 * One season's own section, so a figure from the other year cannot satisfy
 * an assertion about this one. Each is `<section id="<year>" ...>`.
 */
function sectionFor(year: number): string {
  const start = page.indexOf(`<section id="${year}"`)
  expect(start).toBeGreaterThan(-1)
  const next = page.indexOf('<section id="', start + 1)
  return page.slice(start, next === -1 ? undefined : next)
}

/**
 * The page's stat blocks are a value element followed by its label. The
 * source has them on separate lines and the build minifies that away, so the
 * gap between them is optional.
 */
function stat(section: string, label: string): string | undefined {
  return new RegExp(`<div class="stat-v">([^<]+)</div>\\s*<div class="stat-l">${label}</div>`).exec(section)?.[1]
}

describe.each([2025, 2026])('the %i results', (year) => {
  it('names the winner the database names, at the yards it records', async () => {
    const { winner } = await season(year)
    const section = sectionFor(year)

    expect(winner.status).toBe('1st')
    expect(section).toContain(winner.name)
    expect(stat(section, 'winning yards')).toBe(String(winner.yards))
  })

  it('counts the field the database counted', async () => {
    const { started } = await season(year)
    const section = sectionFor(year)

    expect(section).toContain(`${started} starters`)
    expect(stat(section, 'athletes on the start line')).toBe(String(started))
  })

  it('converts yards to kilometres with the loop the database records', async () => {
    const { kilometres, loopMetres } = await season(year)
    const section = sectionFor(year)

    expect(stat(section, 'kilometres covered')).toBe(String(kilometres))
    expect(stat(section, 'km per hourly loop')).toBe(String(loopMetres / 1000))
  })

  it('counts the days the race actually ran', async () => {
    const { days } = await season(year)
    expect(stat(sectionFor(year), 'days of racing')).toBe(String(days))
  })

  it('names the two behind the winner, in the order they finished', async () => {
    const { winner, assist, third } = await season(year)
    const section = sectionFor(year)

    expect(assist.yards).toBeGreaterThanOrEqual(third.yards)
    expect(section.indexOf(winner.name)).toBeLessThan(section.indexOf(assist.name))
    expect(section.indexOf(assist.name)).toBeLessThan(section.indexOf(third.name))
  })
})

describe('the edition comparison', () => {
  it('states differences that are the difference between the two seasons', async () => {
    const a = await season(2025)
    const b = await season(2026)

    expect(page).toContain(`+${b.winner.yards - a.winner.yards}`)
    expect(page).toContain(`+${b.started - a.started}`)
  })

  it('agrees with the loop length the rest of the site uses', async () => {
    const { race } = await import('../resources/data/race')
    expect((await season(2026)).loopMetres).toBe(race.loopMetres)
    expect((await season(2025)).loopMetres).toBe(race.loopMetres)
  })
})
