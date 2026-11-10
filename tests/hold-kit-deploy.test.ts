import { expect, it } from 'bun:test'
import { holdDecision, holdKitDeploy } from '../scripts/hold-kit-deploy'
import { RUN_TITLES } from '../scripts/testflight-runs'

const pinned = 'a'.repeat(40)
const live = 'b'.repeat(40)
const run = (status: string, displayTitle: string = RUN_TITLES.release) => ({ status, displayTitle, url: 'https://github.com/example/runs/1' })

it('lets a deploy on the kit already live straight through', () => {
  // Without asking about runs at all: most deploys change no kit.
  expect(holdDecision({ pinned, live: pinned, runs: [run('in_progress')], check: 1, checks: 80 })).toEqual({ action: 'deploy', message: 'The backend already runs this kit; nothing to hold.' })
})

it('does not hold when the backend cannot say which kit it runs', () => {
  expect(holdDecision({ pinned, live: null, runs: [run('in_progress')], check: 1, checks: 80 }).action).toBe('deploy')
  expect(holdDecision({ pinned, live: '', runs: [run('in_progress')], check: 1, checks: 80 }).action).toBe('deploy')
})

it('waits for a build in flight when the kit changes', () => {
  const decision = holdDecision({ pinned, live, runs: [run('completed'), run('in_progress')], check: 3, checks: 80 })
  expect(decision.action).toBe('wait')
  expect(decision.message).toContain('holding the move to kit aaaaaaaaa (check 3 of 80)')
  // A release waiting its turn is lost to a kit change as surely as one running.
  for (const status of ['queued', 'pending', 'waiting', 'requested']) expect(holdDecision({ pinned, live, runs: [run(status)], check: 1, checks: 80 }).action).toBe('wait')
  // Started by hand before the workflow named its runs: it may be an upload.
  expect(holdDecision({ pinned, live, runs: [run('in_progress', 'TestFlight')], check: 1, checks: 80 }).action).toBe('wait')
})

it('deploys a kit change when nothing that uploads is in flight', () => {
  expect(holdDecision({ pinned, live, runs: [], check: 1, checks: 80 }).action).toBe('deploy')
  expect(holdDecision({ pinned, live, runs: [run('completed')], check: 1, checks: 80 }).action).toBe('deploy')
  // Acceptance alone and a re-check upload nothing the kit could strand.
  expect(holdDecision({ pinned, live, runs: [run('in_progress', RUN_TITLES.acceptance), run('queued', `${RUN_TITLES.recheck}42`)], check: 1, checks: 80 }).action).toBe('deploy')
})

it('warns and deploys when GitHub will not list the runs', () => {
  expect(holdDecision({ pinned, live, runs: null, check: 1, checks: 80 })).toEqual({ action: 'deploy', warning: true, message: 'Could not read TestFlight runs; deploying the kit change without waiting.' })
})

it('fails the deploy when the build outlasts the wait', () => {
  const decision = holdDecision({ pinned, live, runs: [run('in_progress')], check: 80, checks: 80 })
  expect(decision.action).toBe('fail')
  expect(decision.message).toContain('the kit change was not deployed')
})

/** Run the whole hold against a scripted backend and run list. */
async function held(options: { live: string | null, runs: Array<ReturnType<typeof run>[] | null>, checks?: number }) {
  const said: string[] = []
  const slept: number[] = []
  let asked = 0
  const code = await holdKitDeploy({
    pinned,
    live: async () => options.live,
    runs: () => options.runs[Math.min(asked++, options.runs.length - 1)]!,
    sleep: async (milliseconds) => { slept.push(milliseconds) },
    say: line => said.push(line),
    checks: options.checks,
  })
  return { code, said, slept, asked }
}

it('asks GitHub nothing when the kit is not changing', async () => {
  expect(await held({ live: pinned, runs: [[run('in_progress')]] })).toEqual({ code: 0, said: ['The backend already runs this kit; nothing to hold.'], slept: [], asked: 0 })
  expect((await held({ live: null, runs: [[run('in_progress')]] })).asked).toBe(0)
})

it('waits a minute at a time until the build is done, then deploys', async () => {
  const result = await held({ live, runs: [[run('in_progress')], [run('in_progress')], [run('completed')]] })
  expect(result.code).toBe(0)
  expect(result.slept).toEqual([60_000, 60_000])
  expect(result.asked).toBe(3)
  expect(result.said).toHaveLength(3)
  expect(result.said[1]).toContain('(check 2 of 80)')
  expect(result.said[2]).toBe('No TestFlight build is in flight; moving the backend to kit aaaaaaaaa.')
})

it('stops waiting, with a warning, when GitHub stops answering', async () => {
  const result = await held({ live, runs: [[run('in_progress')], null] })
  expect(result.code).toBe(0)
  expect(result.said.at(-1)).toBe('::warning::Could not read TestFlight runs; deploying the kit change without waiting.')
})

it('gives up with an error after the last check', async () => {
  const result = await held({ live, runs: [[run('in_progress')]], checks: 3 })
  expect(result.code).toBe(1)
  expect(result.slept).toEqual([60_000, 60_000])
  expect(result.said.at(-1)).toStartWith('::error::A TestFlight build was still in flight after 3 checks')
})
