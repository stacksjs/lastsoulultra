import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { CATALOG, CATALOG_NOTE, catalogDescription, reviewStorefrontOffers } from '../scripts/lsu-demo-catalog'

describe('LSU demo storefront', () => {
  it('does not resurrect demo offers on a deployed coaching catalog', () => {
    const demos = [{ product_id: 8 }, { product_id: 1 }]
    const catalog = [{ product_id: 9 }, { product_id: 10 }, { product_id: 11 }, { product_id: 12 }]
    expect(reviewStorefrontOffers([...catalog, ...demos], demos, true)).toEqual(catalog)
    expect(reviewStorefrontOffers(catalog, demos, true)).toEqual(catalog)
    expect(reviewStorefrontOffers(null, demos, true)).toEqual(demos)
    expect(reviewStorefrontOffers(catalog, demos, false)).toEqual([...demos, ...catalog])
  })

  it('offers the six agreed plans at the agreed prices, one of them free', () => {
    expect(CATALOG.map(item => [item.name, item.price_cents])).toEqual([
      ['First Ultra: 50K in 16 weeks', 7900],
      ['Mountain Ultra Vert Block', 4900],
      ['Back-to-Back Long Run Weekends', 3900],
      ['Strength for Ultrarunners', 2900],
      ['100K / 100 Mile Build', 12900],
      ['Race Week and Fuelling', 0],
    ])
    expect(new Set(CATALOG.map(item => item.slug)).size).toBe(CATALOG.length)
    for (const item of CATALOG) expect(item.slug).toMatch(/^lsu-pawel-[a-z0-9-]+$/)
  })

  it('says on every product that it is an unreviewed demo draft', () => {
    for (const item of CATALOG) expect(catalogDescription(item).endsWith(CATALOG_NOTE)).toBe(true)
    expect(CATALOG_NOTE).toContain('not yet reviewed by him')
  })

  it('plans the weeks it names, with every workout on a real day and within a day', () => {
    const weeks = Object.fromEntries(CATALOG.map(item => [item.slug, item.plan().weeks.length]))
    expect(weeks).toEqual({ 'lsu-pawel-first-ultra-50k': 16, 'lsu-pawel-mountain-vert-block': 8, 'lsu-pawel-back-to-back-weekends': 6, 'lsu-pawel-strength-for-ultrarunners': 6, 'lsu-pawel-100k-100-mile-build': 24, 'lsu-pawel-race-week-fuelling': 2 })
    for (const item of CATALOG) {
      const plan = item.plan()
      expect(plan.weeks.map(week => week.week)).toEqual(plan.weeks.map((_, index) => index + 1))
      for (const week of plan.weeks) {
        for (const workout of week.workouts) {
          expect(workout.day).toBeGreaterThanOrEqual(1)
          expect(workout.day).toBeLessThanOrEqual(7)
          // HQ's plan editor caps a workout at twelve hours (app/Support/planEdit.ts).
          expect(workout.duration_minutes).toBeLessThanOrEqual(720)
          expect(item.sports).toContain(workout.sport)
        }
      }
    }
    // Twelve strength sessions, as the name promises.
    expect(CATALOG.find(item => item.slug === 'lsu-pawel-strength-for-ultrarunners')!.plan().weeks.flatMap(week => week.workouts)).toHaveLength(12)
  })

  it('writes its copy without em or en dashes', () => {
    expect(readFileSync(new URL('../scripts/lsu-demo-catalog.ts', import.meta.url), 'utf8')).not.toMatch(/[–—]/)
  })

  it('is copied into the deploy beside the seeder that imports it', () => {
    expect(readFileSync(new URL('../scripts/prepare-training.ts', import.meta.url), 'utf8')).toContain("'scripts/lsu-demo-catalog.ts'")
  })
})
