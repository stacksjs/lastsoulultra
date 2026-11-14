import type { ScreenshotConfig, ScreenshotContext, ScreenshotFixtures } from '@stacksjs/docs/screenshots'
import inventory from '../resources/data/screens/inventory.json'
import { maskReviewDetails, reviewFixtures, screenReady, trainingProfile } from '../scripts/screenshot-support'

const baseUrl = process.env.LSU_SCREENSHOT_TRAINING_ORIGIN || 'https://training.lsu.stacksjs.com'
const noFixture: Record<string, string> = {
  '/coaches/athletes/[id]': 'Requires a synthetic personal-roster athlete. A coaching-package subscriber is not automatically a personal coaching relationship.',
  '/activity-review/[id]': 'Requires a dedicated unreviewed synthetic activity suggestion; the list and workflow are documented.',
  '/relax/class/[id]': 'Requires a seeded published breathwork class and its separate agreement fixture.',
  '/store/library/[id]': 'Requires a dedicated sandbox purchase; complimentary coaching access is not a purchased-content fixture.',
  '/workouts/[id]/live': 'Requires an explicitly shared live workout fixture; do not publish a real sharing token.',
}
function concrete(path: string, fixtures: ScreenshotFixtures): string {
  if (path.startsWith('/coaching/[brand]')) return '/brands/last-soul-ultra?section=feedback'
  const binding = path.startsWith('/coaches/athletes/') ? fixtures.Athlete : path.startsWith('/store/') ? fixtures.Product : path.startsWith('/messages/') ? fixtures.Person : fixtures.Workout
  return path.replace(/\[([^\]]+)\]/g, (_match, field: string) => {
    const value = binding?.[field === 'person' ? 'id' : field]
    if (value === undefined) throw new Error(`No synthetic fixture for ${path}`)
    return encodeURIComponent(String(value))
  })
}
async function ready(context: ScreenshotContext): Promise<boolean> {
  if (!await screenReady(context)) return false
  await maskReviewDetails(context)
  return true
}
const config: ScreenshotConfig = {
  baseUrl,
  outDir: 'storage/runtime/docs-screen-captures/training',
  backend: 'chrome',
  timeoutMs: 45_000,
  models: false,
  inputs: ['native/hq-source.json', 'native/product.json', 'resources/data/screens/inventory.json', 'scripts/screenshot-support.ts'],
  coverage: { directories: ['pantry/@hq/platform/source/resources/views'] },
  redactEnv: ['LSU_DEMO_ACCOUNTS_JSON'],
  profiles: { visitor: trainingProfile(null), runner: trainingProfile('runner'), coach: trainingProfile('coach'), admin: trainingProfile('admin') },
  data: { prepare: () => reviewFixtures(baseUrl) },
  pages: inventory.screens.filter(screen => screen.group !== 'website').map(screen => ({
    id: screen.id,
    title: screen.title,
    route: screen.path,
    path: screen.path.includes('[') ? ({ fixtures }) => concrete(screen.path, fixtures) : screen.path === '/welcome' ? '/welcome?again=1' : screen.path,
    description: screen.purpose,
    reason: screen.reason,
    sources: [screen.source],
    profiles: [screen.profile],
    waitFor: screen.path === '/welcome' ? '[data-onboarding] [data-ob-next]' : 'main, [data-checkout-return], [data-onboarding]',
    ready,
    masks: ['input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])', 'textarea', '[data-api-key]', '[data-access-token]'],
    ...('skip' in screen ? { skip: screen.skip } : noFixture[screen.path] ? { skip: noFixture[screen.path] } : {}),
  })),
}
const onboarding = [
  ['onboarding-goals', 'Training goals', 'runner', 'Choose all relevant goals; setup can add them to the athlete profile.'],
  ['onboarding-sport', 'Main sport', 'runner', 'Choose the main sport for training context without buying a plan.'],
  ['onboarding-time', 'Weekly availability', 'runner', 'Choose a realistic weekly time budget.'],
  ['onboarding-level', 'Training experience', 'runner', 'Describe relevant experience rather than a target level.'],
  ['onboarding-about', 'Optional personal context', 'runner', 'Optional age and sex provide context and can be left unanswered.'],
  ['onboarding-connect', 'Connect a wearable', 'runner', 'Choose a supported connection or postpone it; no provider authorization is submitted by this capture.'],
  ['onboarding-safety', 'Training safety choice', 'runner', 'Read the two statements. This fixture leaves the choices unsubmitted.'],
  ['onboarding-summary', 'Review setup', 'runner', 'Review the proposed setup before applying it. No setup tasks are submitted by this capture.'],
  ['onboarding-coach-size', 'Coach roster size', 'coach', 'Describe the size of the coaching practice.'],
  ['onboarding-coach-sports', 'Coached sports', 'coach', 'Choose the relevant sports for the coach profile.'],
  ['onboarding-coach-style', 'Coaching style', 'coach', 'Describe how coaching is delivered.'],
]
for (const [id, title, profile, description] of onboarding) config.pages.push({
  id: id!, title: title!, description: `${description} Browser-only synthetic onboarding state; shared account progress and consent remain unchanged.`,
  reason: 'Explain one setup decision at a time without submitting a real consent or modifying shared setup records.',
  path: '/welcome', sources: ['pantry/@hq/platform/source/resources/views/welcome.stx'], profiles: [profile!],
  waitFor: '[data-onboarding][data-part="setup"]', ready,
})

export default config
