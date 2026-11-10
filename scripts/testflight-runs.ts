/**
 * What a run of the TestFlight workflow (.github/workflows/testflight.yml) is,
 * as GitHub lists it. Three scripts read those runs: the release command, the
 * deploy's kit hold and the acceptance starter. Two of them run on GitHub
 * before the kit is installed, so this file imports nothing.
 */

/** One row of `gh run list --workflow testflight.yml --json <RUN_FIELDS>`. */
export interface TestFlightRun {
  databaseId: number
  event: string
  status: string
  conclusion: string | null
  headSha: string
  url: string
  displayTitle: string
  createdAt: string
}

export const TESTFLIGHT_WORKFLOW = 'testflight.yml'
export const RUN_FIELDS = 'databaseId,event,status,conclusion,headSha,url,displayTitle,createdAt'

/**
 * The names the workflow gives its runs (`run-name`), so the list says what a
 * run is for. Runs from before the workflow named them are all "TestFlight".
 */
export const RUN_TITLES = {
  /** After Deploy, for a release commit. */
  release: 'TestFlight',
  /** Started by hand with `upload` on. */
  upload: 'TestFlight upload by hand',
  /** Build and acceptance only; nothing is signed or uploaded. */
  acceptance: 'Native acceptance, no upload',
  /** `verify_run`: asks Apple about an earlier upload. The run id follows. */
  recheck: 'TestFlight re-check of run ',
} as const

/** A step's outcome in a run, whichever job it belongs to. */
export interface RunStep { name: string, conclusion: string | null }
export const ACCEPTANCE_STEP = 'Test the downloaded application against the isolated LSU API'
/** The last thing an upload does: Apple has the build, the internal groups have it, What to Test is set. */
export const AVAILABILITY_STEP = 'Verify TestFlight processing and internal availability'

/** Whether a run can end in an upload. Only a run named as one that cannot is taken at its word. */
export function mayUpload(run: Pick<TestFlightRun, 'displayTitle'>): boolean {
  return run.displayTitle !== RUN_TITLES.acceptance && !run.displayTitle.startsWith(RUN_TITLES.recheck)
}

/** The runs that are queued or running and could still upload a build. */
export function uploadsInFlight<Run extends Pick<TestFlightRun, 'status' | 'displayTitle'>>(runs: Run[]): Run[] {
  return runs.filter(run => run.status !== 'completed' && mayUpload(run))
}
