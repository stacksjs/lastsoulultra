import { describe, expect, it } from 'bun:test'
import { coachingModule, coachingModules, enabledModules, indexableModulePaths, modulePath } from '../resources/data/coaching'

describe('the coaching module registry', () => {
  it('uses each HQ module key once, as its own URL segment', () => {
    const slugs = coachingModules.map(module => module.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z]+$/)
      expect(modulePath(slug)).toBe(`/coaching/${slug}`)
    }
  })

  it('covers the eight modules HQ publishes, and nothing invented', () => {
    expect(coachingModules.map(module => module.slug).sort()).toEqual(
      ['account', 'calendar', 'feedback', 'health', 'library', 'messages', 'plans', 'progress'],
    )
  })

  it('shows only the storefront when no brand is published', () => {
    // An unreachable or draft brand must not advertise panels that cannot load.
    expect(enabledModules(undefined).map(module => module.slug)).toEqual(['plans'])
    expect(enabledModules([]).map(module => module.slug)).toEqual(['plans'])
  })

  it('keeps this site\'s order rather than the order the brand happens to list', () => {
    expect(enabledModules(['account', 'plans', 'calendar']).map(module => module.slug))
      .toEqual(['plans', 'calendar', 'account'])
  })

  it('ignores a module the brand names that this site does not serve', () => {
    expect(enabledModules(['plans', 'whiteboard']).map(module => module.slug)).toEqual(['plans'])
  })

  it('indexes only what a visitor without an account can actually read', () => {
    expect(indexableModulePaths()).toEqual(['/coaching/plans'])
    for (const module of coachingModules) {
      if (module.scope !== 'public')
        expect(indexableModulePaths()).not.toContain(modulePath(module.slug))
    }
  })

  it('marks health and messages as account-private, because a brand never sees them', () => {
    expect(coachingModule('health')?.scope).toBe('private')
    expect(coachingModule('messages')?.scope).toBe('private')
  })

  it('says what each panel does in a full sentence', () => {
    for (const module of coachingModules) {
      expect(module.summary.length).toBeGreaterThan(40)
      expect(module.summary.endsWith('.')).toBe(true)
      // The site's one hard typographic rule.
      expect(module.summary).not.toContain('—')
      expect(module.title).not.toContain('—')
    }
  })

  it('does not know about a module that is not registered', () => {
    expect(coachingModule('nope')).toBeUndefined()
  })
})
