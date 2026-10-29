/** Fictional, complimentary review access. This is not an approved training prescription. */
export const demoTier = { name: 'Running and strength, demo', price_cents: 2900, currency: 'USD', billing_interval: 'month', sports: ['Run', 'Strength'] } as const

export const demoStrengthDescription = 'Fictional demo session for reviewing illustrated exercises, sets and set-completion controls. Not an approved LSU prescription.'

const exercise = (title: string, set: Record<string, number>) => ({ title, notes: 'Fictional review example. Follow the exercise instructions; no load is prescribed.', sets: [{ ...set }, { ...set }] })
const strength = (second: boolean) => ({ blocks: [
  { kind: 'warmup', title: 'Movement preparation', exercises: [exercise(second ? 'High Knees' : 'A-Skip', { seconds: 20 })] },
  { kind: 'circuit', title: second ? 'Upper body and control' : 'Single-leg stability', exercises: second
    ? [exercise('Arnold Press', { reps: 6 }), exercise('Step Down (eccentric)', { reps_per_side: 6 }), exercise('Heel Taps', { reps: 8 }), exercise('Y-T-W Raise', { reps: 6 })]
    : [exercise('Kettlebell Goblet Reverse Lunge', { reps_per_side: 6 }), exercise('Hammer Curl', { reps: 8 }), exercise('Glute Bridge March', { reps_per_side: 6 })] },
  { kind: 'single', title: 'Finish and recover', exercises: [exercise(second ? 'Foam Roll Quads' : 'Couch Stretch', { seconds: 20 })] },
] })

export function demoPlan() {
  const runs = [
    { day: 1, title: 'Easy aerobic run', duration_minutes: 40, distance_km: 6, tss: 30 },
    { day: 3, title: 'Controlled hill session', duration_minutes: 50, distance_km: 7, tss: 45 },
    { day: 5, title: 'Recovery run', duration_minutes: 30, distance_km: 4, tss: 18 },
    { day: 6, title: 'Long easy trail run', duration_minutes: 90, distance_km: 12, tss: 65 },
  ].map(workout => ({ ...workout, sport: 'Run', description: 'Fictional demo session. Keep the effort comfortable; review the session instructions before training.', steps: [{ name: 'Warm up', duration_minutes: 5, zone: 'Z1', intensity: 'Easy', notes: '' }, { name: workout.title, duration_minutes: workout.duration_minutes - 10, zone: 'Z2', intensity: 'Easy', notes: 'Sample session for reviewing the application.' }, { name: 'Cool down', duration_minutes: 5, zone: 'Z1', intensity: 'Easy', notes: '' }] }))
  const lifts = [false, true].map(second => ({ day: second ? 4 : 2, title: second ? 'Strength B: upper body and control' : 'Strength A: single-leg stability', sport: 'Strength', description: demoStrengthDescription, duration_minutes: 30, distance_km: 0, tss: 15, steps: [], strength: strength(second) }))
  return { summary: 'Fictional eight-week Run + Strength plan for the private LSU review.', phases: [{ name: 'Consistency', start_week: 1, end_week: 4, focus: 'Easy volume and routine' }, { name: 'Endurance', start_week: 5, end_week: 8, focus: 'Long-run consistency and recovery' }], weeks: Array.from({ length: 8 }, (_, index) => ({ week: index + 1, focus: index < 4 ? 'Consistency' : 'Endurance', planned_hours: 4.5, workouts: structuredClone([...runs, ...lifts].sort((a, b) => a.day - b.day)) })) }
}

/** Keep the original four running workout IDs when inserting Tuesday/Thursday strength. */
export function combinedRunKey(key: string, enrollment: string): string {
  const suffix = key.slice(enrollment.length)
  if (!key.startsWith(enrollment) || !/^:w[1-8]:[1-4]$/.test(suffix)) throw new Error(`Unexpected legacy demo workout key: ${key}`)
  return `${enrollment}${suffix.slice(0, -1)}${[1, 3, 5, 6][Number(suffix.at(-1)) - 1]}`
}
