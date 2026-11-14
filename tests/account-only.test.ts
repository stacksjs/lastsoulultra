import { describe, expect, test } from 'bun:test'
import coaching from '../config/coaching'
import server from '../config/server'
import { accountOnlyRedirects, coachingModules, moduleHref, modulePath } from '../resources/data/coaching'

const origin = new URL(coaching.origin).origin
const rules = server.redirects as Record<string, string | { to: string, status?: number }>

describe('pages that need an account', () => {
  test('are never drawn on this site: each one leaves for the training app', () => {
    for (const module of coachingModules.filter(item => item.scope !== 'public')) {
      const rule = rules[modulePath(module.slug)]
      expect(typeof rule).toBe('object')
      const target = (rule as { to: string, status?: number })
      expect(target.to.startsWith(`${origin}/`)).toBe(true)
      // Where it leads depends on who is asking, so it is not a permanent move.
      expect(target.status).toBe(302)
    }
  })

  test('include the coach and staff workspaces', () => {
    for (const path of ['/coach', '/coach/exercises', '/coach/subscribers', '/admin'])
      expect((rules[path] as { to: string }).to.startsWith(`${origin}/`)).toBe(true)
  })

  test('leave the storefront where it is', () => {
    expect(rules['/coaching/plans']).toBeUndefined()
    expect(rules['/coaching']).toBeUndefined()
    expect(moduleHref('plans', origin)).toBe('/coaching/plans')
  })

  test('are linked at the app, so no link on the site leads to a page it does not serve', () => {
    expect(moduleHref('calendar', origin)).toBe(`${origin}/workouts`)
    expect(moduleHref('account', `${origin}/`)).toBe(`${origin}/coaching/${coaching.brand}/account`)
    expect(Object.keys(accountOnlyRedirects(origin))).toHaveLength(11)
  })
})

describe('subscription destinations', () => {
  test('opens method feedback and subscription summaries instead of the general assistant and analytics', () => {
    for (const section of ['feedback', 'progress', 'library', 'account']) {
      const expected = `${origin}/coaching/${coaching.brand}/${section}`
      expect(moduleHref(section, origin)).toBe(expected)
      expect(accountOnlyRedirects(origin)[modulePath(section)]).toEqual({ to: expected, status: 302, preserveQuery: false })
    }
  })
})
