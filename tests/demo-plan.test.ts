import { describe, expect, it } from 'bun:test'
import { combinedRunKey, demoPlan, demoTier } from '../scripts/lsu-demo-plan'

describe('LSU review plan', () => {
  it('includes running and structured strength in the approved EUR 29.99 monthly tier', () => {
    expect(demoTier).toMatchObject({ price_cents: 2999, currency: 'EUR', billing_interval: 'month', sports: ['Run', 'Strength'] })
    const plan = demoPlan()
    expect(plan.weeks).toHaveLength(8)
    for (const week of plan.weeks) {
      expect(week.workouts.filter(workout => workout.sport === 'Run')).toHaveLength(4)
      const lifts = week.workouts.filter(workout => workout.sport === 'Strength')
      expect(lifts).toHaveLength(2)
      expect(week.workouts.map(workout => workout.day)).toEqual([1, 2, 3, 4, 5, 6])
      expect(week.planned_hours).toBe(week.workouts.reduce((minutes, workout) => minutes + workout.duration_minutes, 0) / 60)
      for (const lift of lifts) {
        expect('strength' in lift && lift.strength.blocks.every(block => block.exercises.every(exercise => exercise.sets.length > 0))).toBe(true)
      }
    }
    // Editing one review session must not mutate subsequent weeks.
    plan.weeks[0]!.workouts[0]!.title = 'Edited'
    expect(plan.weeks[1]!.workouts[0]!.title).toBe('Easy aerobic run')
  })

  it('preserves the four running slots when inserting two strength sessions', () => {
    for (let week = 1; week <= 8; week++) {
      expect([1, 2, 3, 4].map(slot => combinedRunKey(`enroll-42:w${week}:${slot}`, 'enroll-42'))).toEqual([1, 3, 5, 6].map(slot => `enroll-42:w${week}:${slot}`))
    }
    for (const key of ['enroll-43:w1:1', 'enroll-42:r1:w1:1', 'enroll-42:w9:1', 'enroll-42:w1:5']) expect(() => combinedRunKey(key, 'enroll-42')).toThrow()
  })
})
