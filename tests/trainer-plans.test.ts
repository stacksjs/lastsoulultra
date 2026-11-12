import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { trainingSites } from '../config/training-cloud'
import { TRAINER_PLAN, trainerIds, trainerPlanAction, trainerPlanSummary } from '../scripts/lsu-trainer-plans'

describe('LSU trainer plans', () => {
  it('counts coach profiles on LSU\'s active staff or belonging to LSU, and nobody else', () => {
    const members = [
      { user_id: 1, role: 'owner', status: 'active' },
      { user_id: 2, role: 'trainer', status: 'active' },
      { user_id: 3, role: 'member', status: 'active' },
      { user_id: 4, role: 'trainer', status: 'invited' },
      { user_id: 5, role: 'admin', status: 'active' },
    ]
    const coaches = [
      { user_id: 2, organization_id: null },
      { user_id: 3, organization_id: null },
      { user_id: 4, organization_id: null },
      // The row comes back from the database as text: ids are compared as numbers.
      { user_id: '6', organization_id: '7' },
      { user_id: 8, organization_id: 9 },
      { user_id: 9, organization_id: null },
      { user_id: 2, organization_id: 7 },
    ]
    // 1 and 5 are staff without a coach profile; 3 is a member, 4 not active,
    // 8 another organization's coach and 9 signed up as a coach by themselves.
    expect(trainerIds(7, members, coaches)).toEqual([2, 6])
    expect(trainerIds(7, [], [])).toEqual([])
  })

  it('grants where the coach workspace is closed or only on trial, and leaves every other cover alone', () => {
    expect(trainerPlanAction({ allowed: false, via: null })).toBe('grant')
    expect(trainerPlanAction({ allowed: true, via: 'trial' })).toBe('grant')
    for (const via of ['plan', 'comp', 'gym'] as const) expect(trainerPlanAction({ allowed: true, via })).toBe('keep')
    // The free athlete plan everyone holds is entitled and not a comp.
    expect(trainerPlanAction({ allowed: false, via: null }, { entitled: true, comped: false })).toBe('grant')
    // HQ keeps one comp per person: a comp for another plan is not overwritten.
    expect(trainerPlanAction({ allowed: false, via: null }, { entitled: true, comped: true })).toBe('skip')
    expect(trainerPlanAction({ allowed: false, via: null }, { entitled: false, comped: true })).toBe('grant')
    expect(TRAINER_PLAN).toBe('coach')
  })

  it('reports counts only', () => {
    expect(trainerPlanSummary({ trainers: 4, granted: 2, kept: { gym: 1, comp: 1 } })).toBe('lsu trainer plans: 4 trainers, 2 given the Coach plan, already covered: 1 by comp, 1 by gym')
    expect(trainerPlanSummary({ trainers: 1, granted: 1, kept: {} })).toBe('lsu trainer plans: 1 trainer, 1 given the Coach plan, none already covered')
    expect(trainerPlanSummary({ trainers: 2, granted: 0, kept: { gym: 1 }, skipped: 1 })).toBe('lsu trainer plans: 2 trainers, 0 given the Coach plan, already covered: 1 by gym, 1 left on another comp')
  })

  it('runs on every deploy, after LSU\'s own people are in place and in LSU\'s own database', () => {
    const preStart = trainingSites()['training-api'].preStart || []
    const step = preStart.indexOf('bun deployment/lsu/grant-trainer-plans.ts')
    expect(step).toBeGreaterThan(preStart.indexOf('./buddy migrate --no-generate --auth'))
    expect(step).toBeGreaterThan(preStart.indexOf('bun deployment/lsu/seed-review.ts'))
    expect(step).toBeGreaterThan(preStart.indexOf('./buddy installation:admins'))
    const prepared = readFileSync(new URL('../scripts/prepare-training.ts', import.meta.url), 'utf8')
    for (const file of ['grant-trainer-plans.ts', 'lsu-trainer-plans.ts']) expect(prepared).toContain(`join(directory, '${file}')`)
    const runner = readFileSync(new URL('../scripts/grant-trainer-plans.ts', import.meta.url), 'utf8')
    expect(runner).toContain('process.env.DB_DATABASE !== \'lsu_training\'')
    expect(runner).toContain('SELECT current_database() AS name')
    // Counts reach the deploy log; a person's address or id never does.
    expect(runner).not.toMatch(/console\.log\([^)]*(email|userId)/)
  })
})
