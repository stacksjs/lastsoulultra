import { expect, it } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { trainingSites } from '../config/training-cloud'
import deployment from '../enterprise/deployment.json'

it('records a launcher that loads private media libraries before the real application launcher', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lsu-media-'))
  try {
    const media = join(directory, 'media')
    await mkdir(media)
    await mkdir(join(directory, 'scripts'))
    const site = trainingSites()['training-api']
    const generated = site.preStart!.find(command => command.includes("<<'LSU_MEDIA_START'"))!.replaceAll(deployment.storageRoot, directory)
    const child = Bun.spawn(['/bin/sh', '-ec', generated], { stdout: 'pipe', stderr: 'pipe' })
    expect(await child.exited).toBe(0)
    expect(await new Response(child.stderr).text()).toBe('')
    expect(await readFile(join(media, 'start-training.sh'), 'utf8')).toBe(await readFile(new URL('../enterprise/start-training.sh', import.meta.url), 'utf8'))
    await writeFile(join(media, 'runtime-env.sh'), 'export LSU_MEDIA_QA=private-libraries\n')
    for (const [name, kind] of [['start-production.sh', 'application'], ['start-local-speech.sh', 'speech']]) {
      const file = join(directory, 'scripts', name!)
      await writeFile(file, `#!/bin/sh\nprintf '%s|%s|%s' '${kind}' "$LSU_MEDIA_QA" "$1"\n`)
      await chmod(file, 0o700)
    }
    for (const [args, expected] of [[['argument with spaces'], 'application|private-libraries|argument with spaces'], [['--local-speech', 'speech argument'], 'speech|private-libraries|speech argument']] as const) {
      const running = Bun.spawn(['/bin/sh', join(media, 'start-training.sh'), ...args], { cwd: directory, env: { PATH: '/usr/bin:/bin' }, stdout: 'pipe', stderr: 'pipe' })
      expect(await running.exited).toBe(0)
      expect(await new Response(running.stdout).text()).toBe(expected)
      expect(await new Response(running.stderr).text()).toBe('')
    }
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})
