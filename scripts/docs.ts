/**
 * Build documentation from a fresh STX cache. The pinned CSS compiler keys its
 * cache by a sorted class set but emits rules in discovery order. Reusing a dev
 * cache can therefore make committed references differ from a clean CI build.
 * Keep each documentation command isolated, including the style guide that the
 * full docs build generates automatically.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const commands: Record<string, string[]> = {
  build: ['build', '--docs'],
  generate: ['docs:style-guide'],
  check: ['docs:style-guide:check'],
}
const args = commands[process.argv[2] || '']
if (!args) throw new Error('Usage: bun scripts/docs.ts build|generate|check')

const cache = await mkdtemp(join(tmpdir(), 'lsu-docs-'))
let code: number
try {
  const child = Bun.spawn(['./buddy', ...args], {
    env: { ...process.env, STX_DIR: cache },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  code = await child.exited
}
finally {
  await rm(cache, { recursive: true, force: true })
}
process.exitCode = code
