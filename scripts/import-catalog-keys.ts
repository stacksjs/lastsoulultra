import { createHash } from 'node:crypto'

/** A key a person can read in a plan file, made unique by what the workout contains. */
export function workoutKey(workout: Record<string, unknown>): string {
  const words = String(workout.title || 'workout').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'workout'
  return `${words}-${createHash('sha256').update(JSON.stringify(workout)).digest('hex').slice(0, 8)}`
}
