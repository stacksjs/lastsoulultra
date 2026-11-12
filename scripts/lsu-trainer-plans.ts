/**
 * Who LSU gives HQ's Coach plan for free, and when.
 *
 * HQ checks a plan before a coach may write (approve a block, draft a plan,
 * send from the coach assistant) and answers 402 `plan_required` once a
 * coach's own free trial has ended. LSU's trainers work for LSU, not for
 * themselves, so LSU covers them: on every deploy each trainer who is not
 * already covered is given the Coach plan as a comp
 * (scripts/grant-trainer-plans.ts, HQ's `grantComp`).
 *
 * A trainer is someone with a coach profile who is on LSU's staff, or whose
 * coach profile belongs to LSU's organization. Someone who only signed up as a
 * coach, and was never added to LSU, keeps HQ's trial: a comp is LSU's to give
 * to its own people, and a coach draws on LSU's AI without a limit.
 *
 * Pure, so the rule is tested here without HQ's source or a database.
 */

/** HQ's plan that opens the coach workspace. An installation supplies the AI itself, so the AI plan adds nothing. */
export const TRAINER_PLAN = 'coach'

/** The roles HQ counts as staff (its app/Support/helpers.ts STAFF_ROLES); `member` is not one. */
export const STAFF_ROLES: readonly string[] = ['owner', 'admin', 'manager', 'front_desk', 'trainer']

export interface Membership { user_id: number | string, role: string, status: string }
export interface CoachProfile { user_id: number | string, organization_id: number | string | null }
/** HQ's answer for the coach workspace (app/Support/planAccess.ts WorkspaceAccess). */
export interface CoachAccess { allowed: boolean, via: 'plan' | 'comp' | 'trial' | 'gym' | null }

/** LSU's trainers, as user ids in order: coach profiles on LSU's active staff or belonging to LSU's organization. */
export function trainerIds(organizationId: number, members: Membership[], coaches: CoachProfile[]): number[] {
  const staff = new Set(members.filter(row => row.status === 'active' && STAFF_ROLES.includes(row.role)).map(row => Number(row.user_id)))
  const ids = coaches
    .filter(row => staff.has(Number(row.user_id)) || (row.organization_id != null && Number(row.organization_id) === organizationId))
    .map(row => Number(row.user_id))
    .filter(id => Number.isInteger(id) && id > 0)
  return [...new Set(ids)].sort((a, b) => a - b)
}

/** The plan a person holds now, as far as this needs it (HQ's CurrentPlan). */
export interface HeldPlan { entitled: boolean, comped: boolean }

/**
 * What a deploy does for one trainer. Someone paying, already comped, or
 * covered by LSU's own gym plan is left exactly as they are; a trial is
 * replaced before it can end, and an ended one is what this exists for.
 *
 * HQ keeps one comp per person, so granting would replace a comp for another
 * plan. That one is left alone and counted, for a person to look at.
 */
export function trainerPlanAction(access: CoachAccess, held: HeldPlan = { entitled: false, comped: false }): 'keep' | 'grant' | 'skip' {
  if (access.allowed && access.via !== 'trial') return 'keep'
  return held.entitled && held.comped ? 'skip' : 'grant'
}

export interface TrainerPlanCounts { trainers: number, granted: number, kept: Record<string, number>, skipped?: number }

/** One line for the deploy log. Counts only: no names, addresses or ids. */
export function trainerPlanSummary(counts: TrainerPlanCounts): string {
  const kept = Object.entries(counts.kept).filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b)).map(([via, count]) => `${count} by ${via}`)
  const covered = kept.length ? `already covered: ${kept.join(', ')}` : 'none already covered'
  const skipped = counts.skipped ? `, ${counts.skipped} left on another comp` : ''
  return `lsu trainer plans: ${counts.trainers} trainer${counts.trainers === 1 ? '' : 's'}, ${counts.granted} given the Coach plan, ${covered}${skipped}`
}
