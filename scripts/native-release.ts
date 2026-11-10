/**
 * The arithmetic and text of an LSU native release, kept apart from the command
 * that runs it (scripts/release-native.ts) so each rule has a test.
 *
 * LSU releases the way HQ does: a marketing version that rarely moves, a build
 * number that goes up by one for every upload, a `chore(release): v<version>-build.<n>`
 * commit and a tag of the same name. The difference is where the numbers live.
 * HQ's are in config/mobile.ts and counted by Xcode Cloud; LSU packages HQ's app
 * from a kit, so its numbers are `version` and `build` in native/product.json and
 * its upload is the TestFlight workflow.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { incrementVersion } from '@stacksjs/bumpx'
import { ACCEPTANCE_STEP, AVAILABILITY_STEP, type RunStep, type TestFlightRun } from './testflight-runs'

/** Where the notes ride in the release commit, as Stacks lays them out beside an iOS project. */
export const NOTES_PROJECT_DIR = 'native'
export const NOTES_DIR = `${NOTES_PROJECT_DIR}/TestFlight`
/** The languages TestFlight shows LSU's notes in when product.json names none. */
export const DEFAULT_NOTES_LOCALES = ['en-US', 'de-DE']
/** Every release commit starts with this; the TestFlight workflow runs only for these. */
export const RELEASE_COMMIT_PREFIX = 'chore(release): v'

export type ReleaseBump = 'build' | 'patch' | 'minor' | 'major' | string

export function releaseTag(version: string, build: number): string {
  return `v${version}-build.${build}`
}

/**
 * The marketing version after `--bump`. `build` keeps it, which is every
 * ordinary release; patch, minor and major go through bumpx, and an exact
 * `x.y.z` is taken as written.
 */
export function bumpedVersion(current: string, bump: ReleaseBump): string {
  if (!/^\d+\.\d+\.\d+$/.test(current)) throw new Error(`native/product.json has no x.y.z version: "${current}"`)
  if (bump === 'build') return current
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump
  if (!['patch', 'minor', 'major'].includes(bump)) throw new Error(`--bump takes build, patch, minor, major or an exact x.y.z, not "${bump}"`)
  return incrementVersion(current, bump)
}

/**
 * The next build number. App Store Connect refuses a number it has seen for the
 * app, in any version, so the count never restarts: one more than the highest of
 * product.json's build and every release tag.
 */
export function nextBuild(current: number, tags: string[]): number {
  if (!Number.isInteger(current) || current < 0) throw new Error(`native/product.json has no whole build number: "${current}"`)
  const tagged = tags.map(tag => /^v\d+\.\d+\.\d+-build\.(\d+)$/.exec(tag.trim())).filter(Boolean).map(match => Number(match![1]))
  return Math.max(current, ...tagged) + 1
}

/**
 * product.json with a new version and build, changing those two lines and
 * nothing else: the file is hashed into every build's receipt, so a release
 * must not reformat it.
 */
export function withRelease(source: string, version: string, build: number): string {
  const versionLine = /^( {2}"version": )"[^"]*"/m
  const buildLine = /^( {2}"build": )\d+/m
  if (!versionLine.test(source) || !buildLine.test(source)) throw new Error('native/product.json must declare top-level "version" and "build"')
  return source.replace(versionLine, `$1"${version}"`).replace(buildLine, `$1${build}`)
}

/** The notes written for a release, per TestFlight locale, or none when the commit carries none. */
export function committedNotes(root: string): Record<string, string> {
  const directory = join(root, NOTES_DIR)
  if (!existsSync(directory)) return {}
  const notes: Record<string, string> = {}
  for (const name of readdirSync(directory).sort()) {
    const locale = /^WhatToTest\.([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.txt$/.exec(name)?.[1]
    const text = locale ? readFileSync(join(directory, name), 'utf8').trim() : ''
    if (locale && text) notes[locale] = text
  }
  return notes
}

/** Whether a commit subject is a release this flow made, and which. */
export function releaseOf(subject: string): { version: string, build: number } | null {
  const match = /^chore\(release\): v(\d+\.\d+\.\d+)-build\.(\d+)$/.exec(subject.trim())
  return match ? { version: match[1]!, build: Number(match[2]) } : null
}

export interface KitManifest { package?: string, version?: string, revision?: string, bun?: string }

/** The pin a kit's own manifest dictates; a kit that does not say what it is cannot be pinned. */
export function pinFromKit(kit: KitManifest, version: string): { package: string, version: string, revision: string, bun: string } {
  if (kit.package !== '@hq/platform') throw new Error(`The installed kit is ${kit.package || 'unnamed'}, not @hq/platform`)
  if (kit.version !== version) throw new Error(`Asked for kit ${version}; the registry installed ${kit.version || 'an unversioned kit'}`)
  if (!/^[a-f0-9]{40}$/.test(kit.revision || '')) throw new Error(`Kit ${version} names no HQ commit`)
  if (!/^\d+\.\d+\.\d+$/.test(kit.bun || '')) throw new Error(`Kit ${version} names no Bun version`)
  return { package: kit.package, version, revision: kit.revision!, bun: kit.bun! }
}

/** pantry.json with the kit and the Bun it needs, touching only those two entries. */
export function withPinnedKit(source: string, version: string, bun: string): string {
  const kitLine = /("@hq\/platform": )"[^"]*"/
  const bunLine = /("bun\.sh": )"[^"]*"/
  if (!kitLine.test(source) || !bunLine.test(source)) throw new Error('pantry.json must declare bun.sh and @hq/platform')
  return source.replace(kitLine, `$1"${version}"`).replace(bunLine, `$1"${bun}"`)
}

/** package.json with LSU's Craft override moved to the version the kit locks, or unchanged when it already matches. */
export function withCraft(source: string, craft: string): string {
  if (!/^\d+\.\d+\.\d+$/.test(craft)) throw new Error(`The kit locks no exact Craft version: "${craft}"`)
  return source.replace(/("(?:craft-native|@craft-native\/ios|@craft-native\/android)": )"\d+\.\d+\.\d+"/g, `$1"${craft}"`)
}

/**
 * The newest run that left its build with TestFlight's testers, among the
 * workflow's runs as GitHub lists them (newest first), or null when none of the
 * runs looked at did.
 *
 * A release commit is not a delivered build: builds 20 and 21 were committed,
 * tagged and built, and their uploads were refused. Only a run whose last
 * upload step succeeded (Apple processed the build, the internal groups have
 * it, What to Test is set) put anything in front of a tester. That is a release
 * run, an upload started by hand, or a later re-check of a slow upload; a
 * successful acceptance-only run uploads nothing and is passed over.
 *
 * `stepsOf` costs a request to GitHub per run, so only successful runs are
 * asked about and no more than `lookups` of them.
 */
export function lastDelivered<Run extends Pick<TestFlightRun, 'status' | 'conclusion'>>(runs: Run[], stepsOf: (run: Run) => RunStep[], lookups = 6): Run | null {
  let asked = 0
  for (const run of runs) {
    if (run.status !== 'completed' || run.conclusion !== 'success') continue
    if (asked++ >= lookups) return null
    if (stepsOf(run).some(step => step.name === AVAILABILITY_STEP && step.conclusion === 'success')) return run
  }
  return null
}

/**
 * How the acceptance of one run ended: `passed`, `failed` (in the acceptance
 * itself, or building the app it would have driven), `unfinished`, or `none`
 * for a run that says nothing about acceptance (a re-check, a cancelled run).
 */
export function acceptanceOutcome(run: Pick<TestFlightRun, 'status' | 'conclusion'>, steps: RunStep[]): 'passed' | 'failed' | 'unfinished' | 'none' {
  if (run.status !== 'completed') return 'unfinished'
  const acceptance = steps.find(step => step.name === ACCEPTANCE_STEP)
  if (!acceptance) return 'none'
  if (acceptance.conclusion === 'success') return 'passed'
  // A failed run that never reached acceptance failed building the app; a
  // release on the same kit stops at the same place.
  return acceptance.conclusion === 'failure' || run.conclusion === 'failure' ? 'failed' : 'none'
}

export interface KitAcceptance<Run> {
  /** The newest finished answer for the kit, or `none` when there is none yet. */
  state: 'passed' | 'failed' | 'none'
  /** The run that gave the answer. */
  run?: Run
  /** A newer run for the same kit that has not finished. */
  running?: Run
}

/**
 * What acceptance last said about a kit, from the runs made on it (newest
 * first; the caller keeps only runs whose commit pins the kit in question).
 * Every run that built and drove the app counts, whether or not it went on to
 * upload: a release, an upload by hand, and the acceptance-only runs started
 * when the pin or the acceptance script changes.
 */
export function kitAcceptance<Run extends Pick<TestFlightRun, 'status' | 'conclusion'>>(runs: Run[], stepsOf: (run: Run) => RunStep[], lookups = 4): KitAcceptance<Run> {
  let running: Run | undefined
  let asked = 0
  for (const run of runs) {
    if (run.conclusion === 'skipped') continue
    if (run.status !== 'completed') {
      running ??= run
      continue
    }
    if (asked++ >= lookups) break
    const outcome = acceptanceOutcome(run, stepsOf(run))
    if (outcome === 'passed' || outcome === 'failed') return { state: outcome, run, running }
  }
  return { state: 'none', running }
}
