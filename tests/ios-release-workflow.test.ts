import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { ACCEPTANCE_STEP, AVAILABILITY_STEP, RUN_TITLES } from '../scripts/testflight-runs'

it('keeps the native build free of signing and production credentials', () => {
  const text = readFileSync(new URL('../.github/workflows/testflight.yml', import.meta.url), 'utf8')
  const workflow = Bun.YAML.parse(text) as any
  // A release commit uploads on its own, after the backend it talks to is live.
  expect(Object.keys(workflow.on)).toEqual(['workflow_run', 'workflow_dispatch'])
  expect(workflow.on.workflow_run).toEqual({ workflows: ['Deploy'], types: ['completed'], branches: ['main'] })
  expect(workflow.permissions).toEqual({ contents: 'read' })
  const job = workflow.jobs.release
  expect(job.if).toContain("github.ref == 'refs/heads/main' && (")
  expect(job.if).toContain("github.event.workflow_run.conclusion == 'success'")
  expect(job.if).toContain("startsWith(github.event.workflow_run.head_commit.message, 'chore(release): v')")
  expect(job.steps[0].with.ref).toBe('${{ github.event.workflow_run.head_sha || github.sha }}')
  // Nothing signs or uploads on a manual acceptance-only run.
  for (const step of job.steps.filter((step: any) => /signing.ts stage|native:testflight|verify-native-testflight/.test(step.run || '')))
    expect(step.if).toBe("inputs.upload || github.event_name == 'workflow_run'")
  expect(job.environment).toBe('ios-testflight')
  expect(job.env).toBeUndefined()
  const build = job.steps.findIndex((step: any) => step.run === 'bun run native:ios')
  const signing = job.steps.findIndex((step: any) => step.run === 'bun scripts/ios-ci-signing.ts stage')
  const acceptance = job.steps.findIndex((step: any) => step.name === 'Test the downloaded application against the isolated LSU API')
  expect(build).toBeGreaterThan(-1)
  expect(signing).toBeGreaterThan(build)
  expect(acceptance).toBeGreaterThan(build)
  expect(signing).toBeGreaterThan(acceptance)
  expect(Object.keys(job.steps[acceptance].env)).toEqual(['LSU_NATIVE_TEST_ACCOUNTS'])
  expect(job.steps.slice(build, acceptance).some((step: any) => step.uses?.startsWith('actions/download-artifact@'))).toBe(true)
  // The build reads HQ's release, installed with a registry token by the step before; it holds no credential itself.
  expect(job.steps[build].env).toBeUndefined()
  expect(job.steps[build - 1]).toMatchObject({ run: 'pantry ci', env: { PANTRY_REGISTRY_TOKEN: '${{ secrets.PANTRY_REGISTRY_TOKEN }}' } })
  const cleanup = job.steps.find((step: any) => step.run === 'bun scripts/ios-ci-signing.ts cleanup')
  expect(cleanup.if).toBe('always()')
  for (const credential of ['DOTENV_PRIVATE_KEY_PRODUCTION', 'CLOUDFLARE_API_TOKEN', 'LSU_TRAINING_DB_PASSWORD', 'LSU_TRAINING_APP_KEY']) expect(text).not.toContain(credential)
  const artifacts = job.steps.find((step: any) => step.uses?.startsWith('actions/upload-artifact@')).with.path
  expect(artifacts).not.toContain('private_keys')
  expect(artifacts).not.toContain('.p8')
  expect(artifacts).not.toContain('.p12')
})

it('re-checks an earlier upload without building or uploading again', () => {
  const workflow = Bun.YAML.parse(readFileSync(new URL('../.github/workflows/testflight.yml', import.meta.url), 'utf8')) as any
  expect(workflow.jobs.release.if).toContain("github.event_name == 'workflow_dispatch' && inputs.verify_run == ''")
  const job = workflow.jobs.verify
  expect(job.if).toBe("github.ref == 'refs/heads/main' && github.event_name == 'workflow_dispatch' && inputs.verify_run != ''")
  expect(job.environment).toBe('ios-testflight')
  expect(job.permissions).toEqual({ contents: 'read', actions: 'read' })
  const runs = job.steps.map((step: any) => step.run || '')
  expect(runs.some((run: string) => /native:ios|native:testflight|build-native-simulator/.test(run))).toBe(false)
  expect(runs).toContain('bun scripts/verify-native-testflight.ts --receipts storage/native/verify-download')
  expect(job.steps.find((step: any) => step.uses?.startsWith('actions/download-artifact@')).with['run-id']).toBe('${{ inputs.verify_run }}')
  expect(job.steps.at(-1)).toMatchObject({ run: 'bun scripts/ios-ci-signing.ts cleanup', if: 'always()' })
})

it('holds a deploy that changes the HQ kit while a TestFlight build is in flight', () => {
  // The upload step refuses an app whose kit the backend no longer runs, so a
  // kit moved mid-build costs the whole build (20 and 21 were lost that way).
  // The decision itself is scripts/hold-kit-deploy.ts (tests/hold-kit-deploy.test.ts).
  const steps = (Bun.YAML.parse(readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')) as any).jobs.deploy.steps as any[]
  const at = (name: string) => steps.findIndex(step => step.name === name)
  const hold = at('Hold a kit change while a TestFlight build is in flight')
  expect(hold).toBeGreaterThan(at('Checkout'))
  // Bun preloads the framework from node_modules (bunfig.toml), so the script
  // cannot run on a bare checkout.
  expect(hold).toBeGreaterThan(at('Setup Bun'))
  expect(hold).toBeGreaterThan(at('Install dependencies'))
  // Before the kit is installed and long before anything is deployed.
  expect(hold).toBeLessThan(at('Install the pinned HQ platform kit'))
  expect(hold).toBeLessThan(at('Deploy'))
  expect(steps[hold]).toEqual({
    name: 'Hold a kit change while a TestFlight build is in flight',
    // Only production runs the backend the app talks to.
    if: "steps.check.outputs.configured == 'true' && (github.event.inputs.environment || 'production') == 'production'",
    env: { GH_TOKEN: '${{ github.token }}' },
    run: 'bun scripts/hold-kit-deploy.ts',
  })
})

it('names each TestFlight run for what it does, as the scripts that read the run list expect', () => {
  const workflow = Bun.YAML.parse(readFileSync(new URL('../.github/workflows/testflight.yml', import.meta.url), 'utf8')) as any
  const name = workflow['run-name'] as string
  expect(name.startsWith('${{ ') && name.endsWith(' }}') && !name.includes('\n')).toBe(true)
  // After Deploy it is a release; by hand it is a re-check, an upload, or acceptance alone.
  expect(name).toBe(`\${{ github.event_name != 'workflow_dispatch' && '${RUN_TITLES.release}' || inputs.verify_run != '' && format('${RUN_TITLES.recheck}{0}', inputs.verify_run) || inputs.upload && '${RUN_TITLES.upload}' || '${RUN_TITLES.acceptance}' }}`)
  // The steps the release command asks GitHub about exist under those names.
  const names = workflow.jobs.release.steps.map((step: any) => step.name)
  expect(names).toContain(ACCEPTANCE_STEP)
  expect(names).toContain(AVAILABILITY_STEP)
  expect(workflow.jobs.verify.steps.map((step: any) => step.name)).toContain(AVAILABILITY_STEP)
  // One build at a time, per job: a run that only skips its job must not
  // displace a release that is waiting its turn.
  expect(workflow.concurrency).toBeUndefined()
  for (const job of [workflow.jobs.release, workflow.jobs.verify]) expect(job.concurrency).toEqual({ 'group': 'lsu-testflight', 'cancel-in-progress': false })
})

it('accepts a new kit or acceptance script without uploading, once it is deployed', () => {
  const text = readFileSync(new URL('../.github/workflows/native-acceptance.yml', import.meta.url), 'utf8')
  const workflow = Bun.YAML.parse(text) as any
  expect(workflow.on).toEqual({ workflow_run: { workflows: ['Deploy'], types: ['completed'], branches: ['main'] } })
  // It may start a workflow and read the repository; it holds no secret.
  expect(workflow.permissions).toEqual({ contents: 'read', actions: 'write' })
  expect(text).not.toContain('secrets.')
  const job = workflow.jobs.start
  expect(job.environment).toBeUndefined()
  expect(job.if).toContain("github.event.workflow_run.conclusion == 'success'")
  // A release commit is the TestFlight workflow's, which accepts before it uploads.
  expect(job.if).toContain("!startsWith(github.event.workflow_run.head_commit.message, 'chore(release): v')")
  expect(job.steps[0].with.ref).toBe('${{ github.event.workflow_run.head_sha }}')
  expect(job.steps.at(-1).run).toBe('bun scripts/native-acceptance.ts "$DEPLOYED"')
  // The only way it starts the TestFlight workflow is with the upload off, and
  // that workflow signs and uploads on nothing but `upload` or a release commit.
  const script = readFileSync(new URL('../scripts/native-acceptance.ts', import.meta.url), 'utf8')
  const starts = script.split('\n').filter(line => line.includes('\'workflow\', \'run\''))
  expect(starts).toHaveLength(1)
  expect(starts[0]).toContain('\'-f\', \'upload=false\')')
  expect(script).not.toContain('upload=true')
  const testflight = Bun.YAML.parse(readFileSync(new URL('../.github/workflows/testflight.yml', import.meta.url), 'utf8')) as any
  const release = testflight.jobs.release
  expect(release.if.replace(/\s+/g, ' ')).toBe("github.ref == 'refs/heads/main' && ( (github.event_name == 'workflow_dispatch' && inputs.verify_run == '') || ( github.event.workflow_run.conclusion == 'success' && startsWith(github.event.workflow_run.head_commit.message, 'chore(release): v') ) )")
  const gated = release.steps.filter((step: any) => step.if === "inputs.upload || github.event_name == 'workflow_run'").map((step: any) => step.run)
  expect(gated).toEqual(['bun scripts/ios-ci-signing.ts stage', 'bun run native:testflight --prepared', 'bun scripts/verify-native-testflight.ts'])
  expect(testflight.on.workflow_dispatch.inputs.upload.type).toBe('boolean')
})
