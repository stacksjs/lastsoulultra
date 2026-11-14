/* eslint-disable no-console */
/**
 * What a deploy has to be able to do, checked against the deployed site.
 *
 * The test suite renders templates; this asks the servers. It runs as the last
 * step of the Deploy workflow, so a deploy that leaves the site unable to do
 * one of these things fails where somebody is looking, not when a visitor
 * finds it. Each check is here because it broke once and nothing noticed:
 *
 *   - a page reached by a link kept the previous page's styles;
 *   - a page that needs an account was drawn for anyone who asked;
 *   - a runner in an installation with no gym was offered a gym's screens;
 *   - the training app ran a different revision than the one pinned here.
 *
 * `--http-only` skips the browser half, for a machine without Chrome.
 *
 * Environment: SITE_AUTH_USER and SITE_AUTH_PASSWORD (the preview gate; both
 * empty once the site is public), LSU_DEMO_ACCOUNTS_JSON (the review accounts),
 * LSU_SITE_ORIGIN (default https://lsu.stacksjs.com).
 */
import { createHash } from 'node:crypto'
import coaching from '../config/coaching'
import diagrams from '../docs/public/diagrams/artifacts.json'
import catalog from '../enterprise/catalog/catalog.json'
import source from '../native/hq-source.json'
import { accountOnlyRedirects } from '../resources/data/coaching'

const site = String(process.env.LSU_SITE_ORIGIN || 'https://lsu.stacksjs.com').replace(/\/$/, '')
const app = new URL(coaching.origin).origin
const user = process.env.SITE_AUTH_USER || ''
const password = process.env.SITE_AUTH_PASSWORD || ''
const gated = Boolean(user && password)
const gate: Record<string, string> = gated ? { Authorization: `Basic ${btoa(`${user}:${password}`)}` } : {}
const httpOnly = process.argv.includes('--http-only')

const failures: string[] = []
let passed = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++
    console.log(`  ok    ${name}`)
    return
  }
  failures.push(detail ? `${name}: ${detail}` : name)
  console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`)
}

/** One request, never following a redirect, never waiting for ever. */
async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) })
}

interface DemoAccount { key: string, email: string, password: string }
function reviewRunner(): DemoAccount | null {
  try {
    const accounts = JSON.parse(process.env.LSU_DEMO_ACCOUNTS_JSON || '[]') as DemoAccount[]
    return accounts.find(account => account.key === 'runner') ?? null
  }
  catch { return null }
}

console.log(`Site ${site}${gated ? ' (behind the preview gate)' : ''}, training app ${app}`)

// The gate itself: a private preview that answers without credentials is not private.
if (gated) {
  const open = await get(`${site}/`)
  check('the preview asks for its password', open.status === 401, `answered ${open.status}`)
}

// The pages this site serves.
for (const path of ['/', '/format', '/world-series', '/soul-races', '/app', '/coaching', '/coaching/plans']) {
  const page = await get(`${site}${path}`, gate)
  check(`serves ${path}`, page.status === 200, `answered ${page.status}`)
}

// Verify the published guide and exact artifact bytes from this deployment.
// An HTML fallback can answer 200 for a missing static file, so status alone is
// insufficient for artwork, CSS and standalone diagrams.
for (const path of ['/docs/', '/docs/visual-guide', '/docs/training/feedback']) {
  const page = await get(`${site}${path}`, gate)
  const html = await page.text()
  check(`serves the guide at ${path}`, page.status === 200 && html.includes('bp-doc'), `answered ${page.status}`)
  if (path === '/docs/visual-guide') {
    check('the live guide includes its visuals and reading styles', html.includes('/docs/guide.css') && html.includes('guide-movements') && html.includes('/docs/diagrams/weekly-training/index.html'))
  }
}
const assets: Record<string, string> = Object.fromEntries(Object.entries(diagrams.files).map(([file, hash]) => [`diagrams/${file}`, hash]))
for (const file of ['guide.css', 'workout-art/lunge-reverse-goblet-frames.svg', 'workout-art/glute-bridge-march-frames.svg']) {
  assets[file] = createHash('sha256').update(new Uint8Array(await Bun.file(new URL(`../docs/public/${file}`, import.meta.url)).arrayBuffer())).digest('hex')
}
for (const [file, hash] of Object.entries(assets)) {
  const response = await get(`${site}/docs/${file.replace(/index\.html$/, '')}`, gate)
  const actual = createHash('sha256').update(new Uint8Array(await response.arrayBuffer())).digest('hex')
  check(`publishes the current docs asset ${file}`, response.status === 200 && actual === hash, `answered ${response.status}${actual === hash ? '' : ', content differs from the commit'}`)
}

// A page reached by a link is fetched as a fragment, and the fragment has to
// name the page's own stylesheets for the router to add them (stx 0.2.847).
const fragment = await (await get(`${site}/coaching`, { ...gate, 'X-STX-Router': 'true', 'X-STX-Fragment': 'true' })).text()
check('a page fetched by a link click names its own stylesheets', /<template data-stx-page-css="1">[^]*?coaching-page\.css/.test(fragment))

// Nothing that needs an account is drawn here: each path leaves for the app.
for (const [path, rule] of Object.entries(accountOnlyRedirects(coaching.origin))) {
  const answer = await get(`${site}${path}`, gate)
  check(`${path} leaves for the training app`, answer.status === 302 && answer.headers.get('location') === rule.to, `answered ${answer.status} ${answer.headers.get('location') ?? ''}`)
}

// The training app: the pinned revision, the coach's four packages and working sign-in.
const deployment: any = await (await get(`${app}/api/deployment`)).json().catch(() => null)
check('the training app runs the pinned revision', deployment?.source === source.revision, `runs ${String(deployment?.source).slice(0, 12)}, pinned ${source.revision.slice(0, 12)}`)

const brand: any = await (await get(`${app}/api/brands/${coaching.brand}`)).json().catch(() => null)
const offers: any[] = Array.isArray(brand?.offers) ? brand.offers : []
for (const product of catalog.products) {
  check(`the store offers ${product.name}`, offers.some(offer => offer.product?.slug === product.slug && Number(offer.product?.price_cents) === product.price_cents && offer.product?.billing_interval === product.billing_interval && offer.product?.currency === product.currency))
  const published: any = await (await get(`${app}/api/store/products/${product.slug}`)).json().catch(() => null)
  check(`${product.slug} uses weekly coach approval after feedback`, published?.training_blocks?.length_days === 7 && published?.training_blocks?.review === 'coach' && published?.training_blocks?.wait_for === 'feedback')
  check(`${product.slug} contains its purchased sports`, JSON.stringify(published?.allowed_training_sports) === JSON.stringify(product.allowed_training_sports) && published?.includes_coaching === false)
  const picture = published?.cover_image_url
  if (typeof picture === 'string' && picture.startsWith(`${app}/assets/native-product/imagery/`)) {
    const photo = await get(picture)
    check(`${product.slug} serves its LSU photograph`, photo.ok && String(photo.headers.get('content-type')).startsWith('image/'))
  }
  else check(`${product.slug} serves its LSU photograph`, false)
}
check('the complimentary demo tiers are absent from the customer storefront', !offers.some(offer => ['lsu-private-demo-running', 'lsu-private-demo-running-only'].includes(offer.product?.slug)))
check('the brand permits embedding on the LSU website', ['https://lastsoulultra.com', 'https://www.lastsoulultra.com'].every(origin => brand?.settings?.embed_origins?.includes(origin)))

const runner = reviewRunner()
let session: { token: string, user: unknown } | null = null
if (!runner) {
  check('a review runner is configured for the sign-in check', false, 'LSU_DEMO_ACCOUNTS_JSON has no runner')
}
else {
  const login = await fetch(`${app}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ email: runner.email, password: runner.password }), signal: AbortSignal.timeout(30_000) })
  const body: any = await login.json().catch(() => null)
  check('the review runner can sign in', login.ok && typeof body?.token === 'string', `answered ${login.status}`)
  if (login.ok && typeof body?.token === 'string') {
    session = { token: body.token, user: body.user }
    const me: any = await (await get(`${app}/api/auth/me`, { Authorization: `Bearer ${body.token}`, Accept: 'application/json' })).json().catch(() => null)
    check('a runner is offered no gym screens', me?.identity?.capabilities?.gym === false, `gym capability is ${String(me?.identity?.capabilities?.gym)}`)
    check('a runner still has their training', me?.identity?.capabilities?.training === true)
  }
}

// The same things, as a browser meets them.
if (!httpOnly) {
  const { launch, navigate, waitFor } = await import('@stacksjs/testing/browser')
  // A hosted runner's Chrome cannot start its sandbox without privileges the job does not have.
  const browser = await launch({ viewport: { width: 1280, height: 900 }, args: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] })
  const { cdp } = browser
  let at = 'starting the browser'
  try {
    // The gate is answered for this site's own requests and for nothing else:
    // a header set on every request would hand the preview's password to
    // whatever other origin the page talks to.
    if (gated) {
      await cdp.send('Fetch.enable', { handleAuthRequests: true, patterns: [{ urlPattern: `${site}/*` }] })
      cdp.on('Fetch.requestPaused', ({ requestId }: any) => { cdp.send('Fetch.continueRequest', { requestId }).catch(() => {}) })
      cdp.on('Fetch.authRequired', ({ requestId, authChallenge }: any) => {
        const ours = String(authChallenge?.origin || '').replace(/\/$/, '') === site
        cdp.send('Fetch.continueWithAuth', { requestId, authChallengeResponse: ours ? { response: 'ProvideCredentials', username: user, password } : { response: 'CancelAuth' } }).catch(() => {})
      })
    }

    at = 'opening the live visual guide'
    await navigate(cdp, `${site}/docs/visual-guide`, { timeoutMs: 60_000 }).catch(() => false)
    await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".guide-movements img"))'), 30_000, { label: 'the visual guide' })
    await cdp.evaluate('document.querySelector(".guide-movements").scrollIntoView({ block: "center" })')
    await waitFor(() => cdp.evaluate('[...document.querySelectorAll(".guide-movements img")].every(img => img.complete && img.naturalWidth > 0)'), 30_000, { label: 'workout figures' })
    check('the live workout figures load', Boolean(await cdp.evaluate('[...document.querySelectorAll(".guide-movements img")].every(img => img.naturalWidth > 0)')))
    await cdp.evaluate('window.scrollTo(0, 0)')
    check('the live guide applies its reading styles', await cdp.evaluate('getComputedStyle(document.querySelector(".guide-flow")).display') === 'grid')
    for (const width of [1280, 390]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 })
      await cdp.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
      check(`the guide fits a ${width}px screen`, Boolean(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')))
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

    at = 'opening /app'
    await navigate(cdp, `${site}/app`, { timeoutMs: 60_000 }).catch(() => false)
    await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".app-hero"))'), 45_000, { label: 'the app page' })
    at = 'following the Coaching link'
    await cdp.evaluate('document.querySelector(\'.nav-links a[href="/coaching"]\').click()')
    await waitFor(() => cdp.evaluate('location.pathname === "/coaching" && Boolean(document.querySelector(".coaching-hero"))'), 45_000, { label: 'the coaching page after a link click' })
    // Give the page's stylesheet the moment it needs to arrive and apply.
    const styled = await waitFor(() => cdp.evaluate('getComputedStyle(document.querySelector(".coaching-hero")).display === "grid"'), 15_000).catch(() => false)
    check('a page reached by a link has its own styles', Boolean(styled))
    const current = await cdp.evaluate('[...document.querySelectorAll(".nav-links a[aria-current]")].map(link => link.textContent.trim()).join(",")')
    check('the nav marks the page a link led to', current === 'Coaching', `marks "${current}"`)

    // Signed out, a page that needs an account ends on the app's sign-in page.
    at = 'opening a page that needs an account, signed out'
    await navigate(cdp, `${site}/coaching/calendar`, { timeoutMs: 60_000 }).catch(() => false)
    const landed = await waitFor(() => cdp.evaluate(`location.origin === ${JSON.stringify(app)} && location.pathname === "/login"`), 45_000).catch(() => false)
    check('a signed-out visitor is sent to the sign-in page', Boolean(landed), String(await cdp.evaluate('location.href')))
    // This browser has chosen no appearance and its device is in light mode,
    // so what it sees is the app's own default: LSU's black, not a white app.
    const mode = String(await cdp.evaluate('document.documentElement.getAttribute("data-color-mode") || ""'))
    check('the app opens in the brand\'s black before anyone chooses', mode === 'dark', `opens ${mode || 'light'}`)

    // Signed in, the runner's home is a running app.
    if (session) {
      at = 'opening the runner\'s home, signed in'
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `if (location.origin === ${JSON.stringify(app)}) { localStorage.setItem('auth_token', ${JSON.stringify(session.token)}); localStorage.setItem('auth_user', ${JSON.stringify(JSON.stringify(session.user))}); }` })
      await navigate(cdp, `${app}/home`, { timeoutMs: 90_000 }).catch(() => false)
      const home = await waitFor(() => cdp.evaluate('location.pathname === "/home" && Boolean(document.querySelector("main h1"))'), 45_000).catch(() => false)
      check('the signed-in runner reaches their home', Boolean(home), String(await cdp.evaluate('location.pathname')))
      const text = String(await cdp.evaluate('document.body.innerText'))
      check('the runner\'s home offers no classes or memberships', !/Book a class|Your classes|Pick a membership/.test(text))
    }
  }
  catch (error) {
    const where = await cdp.evaluate('location.href + " | " + document.title').catch(() => 'no page')
    check('the browser checks ran to the end', false, `while ${at}: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}; page was ${where}`)
  }
  finally { await browser.close() }
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const failure of failures) console.log(`::error::Deployed site check failed: ${failure}`)
  process.exit(1)
}
