/**
 * Where to get the Last Soul Ultra app.
 *
 * The listings are configured, not hard-coded, so the store identifiers can
 * change without a template edit: LSU_APP_STORE_URL takes the App Store
 * listing (https://apps.apple.com/app/id<Apple ID>) and LSU_PLAY_STORE_URL
 * the Google Play one. Google Play listings are addressed by package name,
 * so its default is exact; the App Store default searches for the app by name
 * until the numeric Apple ID is set.
 */

const ANDROID_PACKAGE = 'com.lastsoulultra.app'

function listing(value: string | undefined, fallback: string): string {
  const raw = value?.trim()
  if (!raw) return fallback
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw new Error(`An app store listing must be an https URL, got ${raw}`)
  return url.href
}

export const appStoreUrl = listing(process.env.LSU_APP_STORE_URL, 'https://apps.apple.com/search?term=Last%20Soul%20Ultra')

/**
 * Whether the app has an App Store listing to send people to.
 *
 * Until LSU_APP_STORE_URL names one, the only address this site has is a
 * search for the app's name, and a "Download" button that opens a search with
 * nothing in it is a promise the page cannot keep. The page offers the web
 * app instead and says the iPhone app is still in testing.
 */
export function appStoreListed(value: string | undefined = process.env.LSU_APP_STORE_URL): boolean {
  return Boolean(value?.trim())
}
export const playStoreUrl = listing(process.env.LSU_PLAY_STORE_URL, `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`)

/** The tiers a runner can subscribe to, as published in the app's store. */
export const appTiers = [
  { name: 'LSU Running', price: '€19.99', includes: 'Running sessions from the method in coach-approved weekly blocks, the AI coach, the workout player, progress and recovery.' },
  { name: 'LSU Running + Strength', price: '€29.99', includes: 'Everything in Running, plus strength sessions with a video for every exercise, planned into the same week.' },
] as const

/** The coach's share of every subscription to a tier built on their method. */
export const coachShare = '80%'
