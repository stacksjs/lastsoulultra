/**
 * Release the LSU app to TestFlight with one command, the way HQ's
 * `bun run release:build` does:
 *
 *   bun run release:build [--dry-run] [--notes "What to test" | --notes-file path] [--no-wait]
 *   bun run release:minor | release:major | bun scripts/release-native.ts --bump 1.2.0
 *
 * It takes the next build number and writes the tester notes from the
 * conventional commits since the last build that reached TestFlight (logsmith's
 * grouping, through Stacks' release notes). A build whose upload was refused
 * told testers nothing, so its changes stay in the next notes. bumpx then makes the release itself, as it does for
 * every Stacks package: it moves the release version in package.json
 * (`<version>-build.<n>`), has logsmith write that release's section of
 * CHANGELOG.md, commits `chore(release): v<version>-build.<n>` with it, and
 * creates the annotated tag that carries the same section. The Release workflow
 * reads the section back out of CHANGELOG.md for the tag's GitHub release.
 * Commit and tag are pushed together. From there nothing needs a laptop: CI runs on the push, Deploy
 * follows CI, and the TestFlight workflow follows Deploy for a release commit
 * (.github/workflows/testflight.yml). The command stays to watch that run and
 * says how it ended; `--no-wait` leaves once the push is out.
 *
 * Moving the HQ kit is a separate, earlier step (`bun run native:pin <version>`),
 * because the backend has to be running a kit before an app built on it ships.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { commitsBetween, fitNotes, NO_VISIBLE_CHANGES, resolveNotes, TESTFLIGHT_NOTES_LIMIT, testerNotes, writeWhatToTest } from '@stacksjs/actions/release-notes'
import { versionBump } from '@stacksjs/bumpx'
import { bumpedVersion, DEFAULT_NOTES_LOCALES, lastDelivered, nextBuild, NOTES_PROJECT_DIR, RELEASE_COMMIT_PREFIX, releaseTag, withRelease } from './native-release'
import { RUN_FIELDS, type RunStep, TESTFLIGHT_WORKFLOW, type TestFlightRun } from './testflight-runs'

const root = resolve(import.meta.dir, '..')
const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  const value = index === -1 ? undefined : args[index + 1]
  if (index !== -1 && (!value || value.startsWith('--'))) throw new Error(`${name} needs a value`)
  return value
}
if (args.includes('--help')) {
  process.stdout.write('bun run release:build [--dry-run] [--notes "What to test" | --notes-file path] [--no-wait] [--no-push]\nbun scripts/release-native.ts --bump build|patch|minor|major|x.y.z\n\nTester notes are generated from the conventional commits since the last build that reached TestFlight unless --notes, --notes-file, RELEASE_NOTES or release.notes in native/product.json says otherwise.\n')
  process.exit(0)
}
const dryRun = args.includes('--dry-run')
const wait = !args.includes('--no-wait')
// Stop after the local commit and tag, to look at them before anything leaves this machine.
const push = !args.includes('--no-push')
const bump = option('--bump') || 'build'
const say = (text: string) => process.stdout.write(`${text}\n`)
const git = (...values: string[]) => execFileSync('git', values, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const gh = (...values: string[]) => execFileSync('gh', values, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

// Exactly what is on main, and nothing a laptop has that main does not.
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch !== 'main') throw new Error(`Releases are cut from main; this is ${branch}`)
if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('Commit or stash your changes first, so the release is exactly what is on main')
if (!dryRun) git('pull', '--quiet', '--rebase', 'origin', 'main')
git('fetch', '--quiet', '--tags', 'origin')

const productPath = join(root, 'native/product.json')
const productSource = readFileSync(productPath, 'utf8')
const product = JSON.parse(productSource) as { version: string, build: number, site: string, bundleId: string, release?: { notes?: string, notesFile?: string, noteTypes?: string[], excludeScopes?: string[], locales?: string[] } }
const source = JSON.parse(readFileSync(join(root, 'native/hq-source.json'), 'utf8')) as { version: string, revision: string }
// bumpx finds the previous release from package.json's version, so it has to
// name the release product.json is at; a build number moved by hand breaks that.
const packaged = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }).version
if (packaged !== `${product.version}-build.${product.build}`)
  throw new Error(`package.json is at ${packaged} and native/product.json at ${product.version} build ${product.build}. Releases move both together; set package.json's version to ${product.version}-build.${product.build} before releasing.`)
const version = bumpedVersion(product.version, bump)
const build = nextBuild(product.build, git('tag', '--list', 'v*-build.*').split('\n'))
const tag = releaseTag(version, build)

// An app talks to the backend it was built for. The workflow refuses a build
// whose kit the backend is not running yet, forty minutes in; say so now.
const backend = await fetch(`${product.site}/api/deployment`, { redirect: 'error', signal: AbortSignal.timeout(15_000) }).then(response => response.ok ? response.json() as Promise<{ source?: string }> : null).catch(() => null)
if (!backend) throw new Error(`${product.site} did not answer /api/deployment; the backend has to be up before an app for it ships`)
if (backend.source !== source.revision) {
  const pending = git('rev-list', '--count', 'origin/main..HEAD') !== '0' ? 'Push the pin first' : 'The Deploy workflow for the pin has not finished'
  throw new Error(`The backend runs HQ ${String(backend.source).slice(0, 9)}, and this app is pinned to kit ${source.version} (${source.revision.slice(0, 9)}). ${pending}, then release.`)
}

// What GitHub knows about the TestFlight workflow's runs. One request lists
// them; a run's steps cost one more, so they are asked for once and only for
// the few runs a question turns on. Null when gh cannot answer.
let runs: TestFlightRun[] | null = null
try { runs = JSON.parse(gh('run', 'list', '--workflow', TESTFLIGHT_WORKFLOW, '--limit', '100', '--json', RUN_FIELDS)) as TestFlightRun[] }
catch { runs = null }
const steps = new Map<number, RunStep[]>()
function stepsOf(run: TestFlightRun): RunStep[] {
  if (!steps.has(run.databaseId)) steps.set(run.databaseId, JSON.parse(gh('api', `repos/{owner}/{repo}/actions/runs/${run.databaseId}/jobs`, '--jq', '[.jobs[].steps[] | {name, conclusion}]')) as RunStep[])
  return steps.get(run.databaseId)!
}
const known = (sha: string) => {
  try { return git('cat-file', '-t', sha) === 'commit' }
  catch { return false }
}
/** The commit that last moved the build number, as of a commit: the release that commit belongs to. */
const releaseAt = (sha: string) => git('log', '-1', '--format=%H', '-G', '"build":', sha, '--', 'native/product.json') || undefined
// What testers are told: the commits since the last build they were given,
// unless a person said it themselves. That is not the previous release commit:
// a build can be committed, tagged and built and still never reach TestFlight
// (20 and 21 did not), and its notes went nowhere. So the baseline is the
// build of the newest run that really delivered one. When GitHub cannot say,
// it is the commit that last moved the build number, whether this command or a
// hand made it.
const moved = releaseAt('HEAD')
let previous = moved
let baseline = previous ? `${previous.slice(0, 9)}, where the build number last moved` : 'the first commit'
try {
  const delivered = runs && lastDelivered(runs.filter(run => known(run.headSha)), stepsOf)
  const commit = delivered ? releaseAt(delivered.headSha) : undefined
  if (!delivered || !commit) throw new Error('no run that reached TestFlight')
  git('merge-base', '--is-ancestor', commit, 'HEAD')
  const reached = (JSON.parse(git('show', `${commit}:native/product.json`)) as { build: number }).build
  previous = commit
  baseline = `build ${reached} (${commit.slice(0, 9)}), the last build that reached TestFlight: ${delivered.url}`
  if (commit !== moved) say(`Build ${reached} is the last one testers were given; later builds did not reach TestFlight, so their changes are in these notes too.`)
}
catch {
  say(`Warning: GitHub did not say which build last reached TestFlight; writing the notes from the commits since ${baseline}. If that build never reached testers, say what they missed with --notes.`)
}
const commits = commitsBetween(root, previous, 'HEAD')
const config = product.release ?? {}
const notes = resolveNotes({ cwd: root, flags: { notes: option('--notes'), notesFile: option('--notes-file') }, env: process.env, config, generate: () => testerNotes(commits, { types: config.noteTypes, excludeScopes: config.excludeScopes }) })
const text = fitNotes(notes.text || NO_VISIBLE_CHANGES, TESTFLIGHT_NOTES_LIMIT)
const locales = config.locales?.length ? config.locales : DEFAULT_NOTES_LOCALES
const origin = notes.source === 'generated' ? `${commits.length} commits since ${baseline}` : ({ flag: '--notes', env: 'RELEASE_NOTES', config: 'native/product.json release.notes' } as const)[notes.source]

say(`Releasing ${tag}${version === product.version ? '' : ` (version ${product.version} → ${version})`} on HQ kit ${source.version}`)
say(`\nWhat to Test (${origin}):\n\n${text}\n`)
if (dryRun) {
  say(`Dry run complete: would write CHANGELOG.md's section for ${tag}, commit ${RELEASE_COMMIT_PREFIX}${tag.slice(1)}, tag ${tag}, push both, and let CI, Deploy and TestFlight follow. Nothing was changed.`)
  process.exit(0)
}

// The app's own inputs are staged first, so they ride in the commit bumpx makes.
writeFileSync(productPath, withRelease(productSource, version, build))
const written = writeWhatToTest(root, NOTES_PROJECT_DIR, text, locales)
git('add', '--', 'native/product.json', ...written)
try {
  // bumpx owns the release: the version in package.json, CHANGELOG.md from
  // logsmith over previous-tag..this-tag (amended into the release commit), and
  // an annotated tag whose message is that section. It finds the previous tag
  // from package.json's current version, which is why that holds the whole
  // `<version>-build.<n>` rather than the marketing version alone.
  await versionBump({ cwd: root, release: tag.slice(1), files: [join(root, 'package.json')], recursive: false, commit: `${RELEASE_COMMIT_PREFIX}%s`, tag: 'v%s', changelog: true, push: false, install: false, yes: true, ci: true, noGitCheck: true })
}
catch (error) {
  process.stderr.write('The release was not made. Put the tree back with `git reset --hard origin/main` (and `git tag -d ' + tag + '` if the tag exists) before trying again.\n')
  throw error
}
// bumpx reports some failures as warnings; a release without its commit, tag or changelog is not one.
const subject = git('log', '-1', '--format=%s')
if (subject !== `${RELEASE_COMMIT_PREFIX}${tag.slice(1)}`) throw new Error(`bumpx did not make the release commit; HEAD is "${subject}"`)
if (git('tag', '--points-at', 'HEAD', '--list', tag) !== tag) throw new Error(`bumpx did not tag ${tag} on the release commit`)
const released = git('show', '--name-only', '--format=', 'HEAD').split('\n')
for (const path of ['CHANGELOG.md', 'package.json', 'native/product.json', ...written.map(file => file.replace(`${root}/`, ''))]) {
  if (!released.includes(path)) throw new Error(`The release commit is missing ${path}; nothing was pushed. Undo it with \`git tag -d ${tag} && git reset --hard origin/main\`.`)
}
if (!readFileSync(join(root, 'CHANGELOG.md'), 'utf8').split('\n').some(line => line.toLowerCase().includes('[compare changes]') && line.includes(tag.slice(1))))
  throw new Error(`CHANGELOG.md has no section for ${tag}, so its GitHub release would be empty; nothing was pushed. Undo with \`git tag -d ${tag} && git reset --hard origin/main\`.`)
if (!push) {
  say(`Made ${tag} locally and pushed nothing. Publish it with \`git push --atomic origin main ${tag}\`, or undo it with \`git tag -d ${tag} && git reset --hard origin/main\`.`)
  process.exit(0)
}
// Together or not at all: a tag without its commit on main names a release nobody can build.
git('push', '--atomic', 'origin', 'main', tag)
const sha = git('rev-parse', 'HEAD')
say(`Pushed ${tag} (${sha.slice(0, 9)}). CI, then Deploy, then TestFlight run from here on their own.`)

if (!wait) {
  say('Not waiting. Follow it with `gh run list --workflow testflight.yml`.')
  process.exit(0)
}

/** The newest run of a workflow for this commit, or none yet. */
function runFor(workflow: string): { id: number, status: string, conclusion: string, url: string } | null {
  const rows = JSON.parse(gh('run', 'list', '--workflow', workflow, '--limit', '20', '--json', 'databaseId,headSha,status,conclusion,url')) as Array<{ databaseId: number, headSha: string, status: string, conclusion: string, url: string }>
  const row = rows.find(candidate => candidate.headSha === sha)
  return row ? { id: row.databaseId, status: row.status, conclusion: row.conclusion, url: row.url } : null
}

/** Wait for a workflow's run on this commit to finish. Null when none appeared in time. */
async function finished(workflow: string, appearMinutes: number, finishMinutes: number): Promise<{ conclusion: string, url: string } | null> {
  const appearBy = Date.now() + appearMinutes * 60_000
  let announced = false
  for (;;) {
    const run = runFor(workflow)
    if (run) {
      if (!announced) say(`${workflow}: ${run.url}`)
      announced = true
      if (run.status === 'completed') return { conclusion: run.conclusion, url: run.url }
      if (Date.now() > appearBy + finishMinutes * 60_000) throw new Error(`${workflow} is still running after ${appearMinutes + finishMinutes} minutes: ${run.url}`)
    }
    else if (Date.now() > appearBy) { return null }
    await Bun.sleep(30_000)
  }
}

try { gh('--version') }
catch { throw new Error(`${tag} is pushed and will release on its own; install GitHub's \`gh\` to watch it from here`) }

for (const workflow of ['ci.yml', 'deploy.yml']) {
  const run = await finished(workflow, 10, 30)
  if (!run) throw new Error(`${tag} is pushed, but no ${workflow} run appeared for it. Check the repository's Actions.`)
  if (run.conclusion !== 'success') throw new Error(`${workflow} ended ${run.conclusion} for ${tag}, so TestFlight did not start: ${run.url}. Fix it on main and start the upload with \`gh workflow run testflight.yml --ref main\`; the build number is already taken.`)
}
// The workflow starts itself after Deploy. If another commit reached main in
// between, Deploy ran for that one and the chain did not see a release commit.
let upload = await finished('testflight.yml', 5, 90)
if (!upload) {
  say('TestFlight did not start on its own (a newer commit reached main first); starting it for main.')
  gh('workflow', 'run', 'testflight.yml', '--ref', 'main', '-f', 'upload=true')
  const startedBy = Date.now() + 5 * 60_000
  let url = ''
  while (!url && Date.now() < startedBy) {
    await Bun.sleep(15_000)
    const rows = JSON.parse(gh('run', 'list', '--workflow', 'testflight.yml', '--event', 'workflow_dispatch', '--limit', '1', '--json', 'databaseId,status,url,createdAt')) as Array<{ databaseId: number, status: string, url: string, createdAt: string }>
    if (rows[0] && rows[0].status !== 'completed') url = rows[0].url
  }
  if (!url) throw new Error('The TestFlight workflow could not be started; run `gh workflow run testflight.yml --ref main`')
  say(`testflight.yml: ${url}`)
  const id = url.split('/').at(-1)!
  const deadline = Date.now() + 90 * 60_000
  for (;;) {
    const run = JSON.parse(gh('run', 'view', id, '--json', 'status,conclusion')) as { status: string, conclusion: string }
    if (run.status === 'completed') { upload = { conclusion: run.conclusion, url }; break }
    if (Date.now() > deadline) throw new Error(`TestFlight is still running after 90 minutes: ${url}`)
    await Bun.sleep(30_000)
  }
}
if (upload!.conclusion !== 'success') throw new Error(`TestFlight ended ${upload!.conclusion} for ${tag}: ${upload!.url}. If the upload itself succeeded and only Apple's processing was slow, re-check it without uploading again: \`gh workflow run testflight.yml --ref main -f verify_run=${upload!.url.split('/').at(-1)}\`. Otherwise the build number is taken: fix the cause on main and release the next build.`)
say(`${tag} is on TestFlight and available to its internal testers: ${upload!.url}`)
