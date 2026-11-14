import coaching from '../../config/coaching'

/**
 * The coaching modules, in LSU's own words.
 *
 * HQ publishes eight composable training modules and a navigation list for the
 * brand. This site does not simply print HQ's labels: a runner arriving from
 * /format should read the same voice here as everywhere else, so the label,
 * the page heading and the one-line summary are LSU's. HQ remains the only
 * source of the data inside each panel, and of whether a module is enabled at
 * all - `enabledModules()` intersects this list with the published brand.
 *
 * `scope` is the part worth keeping straight:
 *   'public'  - readable without a training account. The storefront.
 *   'athlete' - needs a signed-in LSU subscriber. Noindex, and said plainly on
 *               the page rather than discovered after a click.
 *   'private' - as athlete, and additionally account-scoped inside the training app: the
 *               athlete's own health metrics and messages, which a brand never
 *               sees. LSU must never imply it can read them.
 */

export type ModuleScope = 'public' | 'athlete' | 'private'

export interface CoachingModule {
  /** HQ's module key. Also this site's URL segment, under /coaching/. */
  slug: string
  /** Nav word. LSU's, not HQ's. */
  label: string
  /** Page heading. */
  title: string
  /** One line, in the site's voice, saying what the panel actually does. */
  summary: string
  scope: ModuleScope
}

export const coachingModules: CoachingModule[] = [
  {
    slug: 'plans',
    // The public website names this module Store. The native product's
    // bottom tabs and top/menu shortcuts are configured in native/product.json;
    // they are not inferred from this website's module list.
    label: 'Store',
    title: 'What is open',
    summary: 'The tiers that are open, what each one covers and what it costs.',
    scope: 'public',
  },
  {
    // `calendar` is HQ's key and stays HQ's key; this site calls the panel
    // Workouts, which is what the runner is actually looking at. Renaming
    // the slug would mean this module stopped matching the brand payload
    // and vanished from the nav.
    slug: 'calendar',
    label: 'Workouts',
    title: 'Your workouts',
    summary: 'The sessions your method has given you, sized to the days you have. Log the sets, the time and how hard it was.',
    scope: 'athlete',
  },
  {
    slug: 'feedback',
    label: 'Say how it felt',
    title: 'Say how it felt',
    summary: 'Talk or type about a session. You read the transcript back before you send it, and the AI coach explains what your data shows.',
    scope: 'athlete',
  },
  {
    slug: 'progress',
    label: 'Progress',
    title: 'What you have done',
    summary: 'Sessions assigned and finished across your active training enrollments.',
    scope: 'athlete',
  },
  {
    slug: 'library',
    label: 'The method',
    title: 'The method you are in',
    summary: 'The coach behind your tier and the published summary of how they train people. The private methodology stays with them.',
    scope: 'athlete',
  },
  {
    slug: 'health',
    label: 'Health',
    title: 'Your health data',
    summary: 'Sleep, heart rate and the rest, read from your own account. This site never sees it and neither does the race.',
    scope: 'private',
  },
  {
    slug: 'messages',
    label: 'Messages',
    title: 'Your messages',
    summary: 'Your own inbox, read from your own account. Not a channel to the race, and not something the race can read.',
    scope: 'private',
  },
  {
    slug: 'account',
    label: 'Me',
    title: 'Billing and renewal',
    summary: 'Cancel, resume a renewal, or open billing. Payment is handled where your account lives, never on this site.',
    scope: 'athlete',
  },
]

const bySlug = new Map(coachingModules.map(module => [module.slug, module]))

export function coachingModule(slug: string): CoachingModule | undefined {
  return bySlug.get(slug)
}

/** The URL this site serves a module at. */
export function modulePath(slug: string): string {
  return `/coaching/${slug}`
}

/**
 * Where each account-only module lives in the training app itself.
 *
 * This site serves the storefront and nothing behind it. A page that needs an
 * account belongs to the application that holds the account: it knows who is
 * signed in, and sends anyone who is not to its own sign-in page and back.
 * This site cannot know either, so it does not draw those pages at all.
 */
const APP_SCREENS: Record<string, string> = {
  calendar: '/workouts',
  feedback: `/coaching/${encodeURIComponent(coaching.brand)}/feedback`,
  progress: `/coaching/${encodeURIComponent(coaching.brand)}/progress`,
  // Keep the subscription context: the general assistant and performance
  // screens do not submit method feedback or show subscription totals.
  library: `/coaching/${encodeURIComponent(coaching.brand)}/library`,
  health: '/metrics',
  messages: '/messages',
  account: `/coaching/${encodeURIComponent(coaching.brand)}/account`,
}

/** The coach and staff workspaces, which are the training app's own screens too. */
const WORKSPACE_SCREENS: Record<string, string> = {
  '/coach': '/coaches/methods',
  '/coach/exercises': '/coaches/exercises',
  '/coach/subscribers': '/coaches/subscribers',
  '/admin': '/staff/experience',
}

/** Where a link to a module goes: this site for the storefront, the training app for the rest. */
export function moduleHref(slug: string, origin: string): string {
  const screen = APP_SCREENS[slug]
  return screen ? `${origin.replace(/\/$/, '')}${screen}` : modulePath(slug)
}

/**
 * The redirect rules for every account-only URL on this site, each to its
 * screen in the training app. 302, because where it leads depends on who asks:
 * the app shows the screen to its owner and its sign-in page to everyone else.
 */
export function accountOnlyRedirects(origin: string): Record<string, { to: string, status: number, preserveQuery: boolean }> {
  const base = origin.replace(/\/$/, '')
  const rules: Record<string, { to: string, status: number, preserveQuery: boolean }> = {}
  for (const [slug, screen] of Object.entries(APP_SCREENS))
    rules[modulePath(slug)] = { to: `${base}${screen}`, status: 302, preserveQuery: false }
  for (const [path, screen] of Object.entries(WORKSPACE_SCREENS))
    rules[path] = { to: `${base}${screen}`, status: 302, preserveQuery: false }
  return rules
}

/**
 * The modules to show, in this site's order, limited to what the published
 * brand enables. An unreachable brand means the storefront only: linking a
 * runner to a panel that cannot load is worse than not offering it.
 */
export function enabledModules(published: readonly string[] | undefined): CoachingModule[] {
  if (!published || published.length === 0)
    return coachingModules.filter(module => module.scope === 'public')
  return coachingModules.filter(module => published.includes(module.slug))
}

/** Only `public` modules may be indexed; the rest need an account to show anything. */
export function indexableModulePaths(): string[] {
  return coachingModules.filter(module => module.scope === 'public').map(module => modulePath(module.slug))
}

/** Base plus the surface sheet: the chrome every coaching route wears. */
export const coachingStyles = [
  '/assets/styles/production/base.css',
  '/assets/styles/production/coaching.css',
]

/**
 * The hub also carries the marketing page's own rules. They are a sheet of
 * their own rather than part of stx-site.css, which every route downloads.
 */
export const coachingHubStyles = [
  ...coachingStyles,
  '/assets/styles/production/coaching-page.css',
]

export interface CoachingPageMeta {
  title: string
  description: string
  styles: string[]
  noindex?: boolean
  /** Origins this page will open a connection to. Read by the head partial. */
  preconnect?: string[]
}

/**
 * Head metadata for a module route. A module that needs an account is noindex:
 * a crawler sees the chrome and a sign-in prompt, which is not a page worth
 * putting in a search result.
 *
 * The <title> leads with `label`, not `title`. They do different jobs: the
 * heading is read with the page in front of you and can afford a sentence,
 * while a tab is read in a strip of eight and is cut to a couple of words.
 * "What you have done" and "What is open" truncate to the same shrug, and
 * seven of these eight are noindex, so this string is almost only ever a tab
 * label. Leading with the nav word also matches the rest of the site
 * ("Administration - Last Soul Ultra"), the nav the reader just clicked and
 * the native app's own tab. The heading below keeps LSU's voice, and so does
 * the breadcrumb, which reads `title` from this registry rather than parsing
 * the string built here.
 */
export function coachingPage(slug: string): CoachingPageMeta {
  const module = coachingModule(slug)
  if (!module)
    throw new Error(`unknown coaching module: ${slug}`)

  return {
    title: `${module.label} - Last Soul Ultra coaching`,
    description: module.summary,
    styles: coachingStyles,
    noindex: module.scope !== 'public',
  }
}
