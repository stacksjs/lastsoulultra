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
 *   'public'  - readable without an HQ account. The storefront.
 *   'athlete' - needs a signed-in HQ subscriber. Noindex, and said plainly on
 *               the page rather than discovered after a click.
 *   'private' - as athlete, and additionally account-scoped inside HQ: the
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
    // Store, Workouts, Health, Messages, Me are the native app's tabs. The
    // nav word matches them so one product does not greet you with two
    // vocabularies; the page headings below stay in this site's voice.
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
    summary: 'Record a voice message after a session. You read the transcript back and send it yourself; next week moves inside the method.',
    scope: 'athlete',
  },
  {
    slug: 'progress',
    label: 'Progress',
    title: 'What you have done',
    summary: 'Sessions given against sessions finished, across every tier you are paying for.',
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
