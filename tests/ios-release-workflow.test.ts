import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

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
