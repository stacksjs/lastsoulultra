import type { ScreenshotContext, ScreenshotFixtures } from '@stacksjs/docs/screenshots'

interface ReviewSession { token: string, user: Record<string, unknown> }
const sessions = new Map<string, Promise<ReviewSession>>()
const network = new WeakMap<Bun.WebView, { pending: Map<string, string>, last: number, started: number }>()

/** Synthetic review accounts only. Login results remain in worker memory. */
export function reviewSession(role: string, baseUrl: string): Promise<ReviewSession> {
  const key = `${baseUrl}/${role}`
  let session = sessions.get(key)
  if (!session) {
    session = (async () => {
      const accounts = JSON.parse(process.env.LSU_DEMO_ACCOUNTS_JSON || '[]') as Array<{ key: string, email: string, password: string }>
      const account = accounts.find(account => account.key === role)
      if (!account || !account.email.endsWith('@lsu-demo.test') || account.password.length < 20) throw new Error(`A synthetic ${role} review account is required`)
      const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(30_000) })
      const result = await response.json() as ReviewSession
      if (!response.ok || !result.token || !result.user) throw new Error(`The ${role} review account could not sign in`)
      return result
    })()
    sessions.set(key, session)
  }
  return session
}

export async function readReview(baseUrl: string, path: string, role = 'runner'): Promise<any> {
  const session = await reviewSession(role, baseUrl)
  const response = await fetch(new URL(path, baseUrl), { headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`The synthetic ${role} fixture could not be read (${response.status})`)
  return response.json()
}

async function observe(view: Bun.WebView, baseUrl: string): Promise<void> {
  await view.navigate('data:text/html,<title>Capture setup</title><main>Capture setup</main>')
  await view.cdp('Network.enable')
  const state = { pending: new Map<string, string>(), last: Date.now(), started: Date.now() }
  network.set(view, state)
  view.addEventListener('Network.requestWillBeSent', (event: MessageEvent<any>) => {
    const { requestId, request, type } = event.data
    if (['Fetch', 'XHR'].includes(type) && String(request?.url || '').startsWith(`${new URL(baseUrl).origin}/api/`)) { state.pending.set(requestId, new URL(request.url).pathname); state.last = Date.now() }
  })
  view.addEventListener('Network.responseReceived', (event: MessageEvent<any>) => {
    if (String(event.data.response?.mimeType || '').includes('text/event-stream') && state.pending.delete(event.data.requestId)) state.last = Date.now()
  })
  for (const event of ['Network.loadingFinished', 'Network.loadingFailed'] as const) view.addEventListener(event, (event: MessageEvent<any>) => {
    if (state.pending.delete(event.data.requestId)) state.last = Date.now()
  })
}

/** The preview gate is answered only for this origin, never all outgoing traffic. */
export async function previewProfile({ view, baseUrl }: ScreenshotContext): Promise<void> {
  const username = process.env.SITE_AUTH_USER
  const password = process.env.SITE_AUTH_PASSWORD
  if (!username || !password) throw new Error('Preview credentials are required')
  await observe(view, baseUrl)
  await view.cdp('Fetch.enable', { handleAuthRequests: true, patterns: [{ urlPattern: `${new URL(baseUrl).origin}/*` }] })
  view.addEventListener('Fetch.requestPaused', (event: MessageEvent<any>) => { void view.cdp('Fetch.continueRequest', { requestId: event.data.requestId }).catch(() => {}) })
  view.addEventListener('Fetch.authRequired', (event: MessageEvent<any>) => {
    const ours = String(event.data.authChallenge?.origin || '').replace(/\/$/, '') === new URL(baseUrl).origin
    void view.cdp('Fetch.continueWithAuth', { requestId: event.data.requestId, authChallengeResponse: ours ? { response: 'ProvideCredentials', username, password } : { response: 'CancelAuth' } }).catch(() => {})
  })
}

export function trainingProfile(role: string | null) {
  return {
    async prepare(context: ScreenshotContext) {
      const { view, baseUrl, page } = context
      await observe(view, baseUrl)
      await view.cdp('Network.setCookie', { name: 'locale', value: 'en', url: baseUrl, path: '/' })
      if (role) {
        const session = await reviewSession(role, baseUrl)
        await view.navigate(`${baseUrl}/login`)
        await view.evaluate(`(() => { localStorage.setItem('auth_token', ${JSON.stringify(session.token)}); localStorage.setItem('auth_user', ${JSON.stringify(JSON.stringify(session.user))}); return true })()`)
      }
      // Tour captures read the real saved answers but keep replay progress in
      // this browser fixture. They do not change the shared account's consent,
      // skip/completion status, invitations or generated setup records.
      if (page.id.includes('welcome') || page.id.includes('onboarding')) {
        const steps: Record<string, string> = {
          'onboarding-goals': 'athlete.goals', 'onboarding-sport': 'athlete.sport',
          'onboarding-time': 'athlete.time', 'onboarding-level': 'athlete.level',
          'onboarding-about': 'athlete.about', 'onboarding-connect': 'athlete.connect',
          'onboarding-safety': 'training.safety', 'onboarding-summary': 'summary',
          'onboarding-coach-size': 'coach.size', 'onboarding-coach-sports': 'coach.sports',
          'onboarding-coach-style': 'coach.style',
        }
        await view.cdp('Fetch.enable', { patterns: [{ urlPattern: `${baseUrl}/api/onboarding`, requestStage: 'Request' }] })
        view.addEventListener('Fetch.requestPaused', (event: MessageEvent<any>) => {
          const { requestId, request } = event.data
          const step = steps[page.id]
          const saved = { status: 'started', step: step || 'welcome', answers: { goals: ['race'], sport: 'run', time: '3to5', level: 'beginner', size: '1to5', sports: ['run'], style: ['remote'] }, setup: {} }
          const payload = request.method === 'GET' ? JSON.stringify(saved) : request.postData || '{}'
          void view.cdp('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(payload).toString('base64') }).catch(() => {})
        })
      }
    },
  }
}

/** Wait for actual data reads to settle; a bare main element can be a spinner. */
export async function screenReady({ view }: ScreenshotContext): Promise<boolean> {
  const state = network.get(view)
  if (state && state.pending.size && Date.now() - state.started > 35_000) throw new Error(`Data requests did not settle: ${[...new Set(state.pending.values())].join(', ')}`)
  if (state && (state.pending.size || Date.now() - state.last < 650)) return false
  return view.evaluate<boolean>(`(() => {
    const visible = node => { const r=node.getBoundingClientRect();return r.width>0&&r.height>0 };
    const main=document.querySelector('main')||document.body;
    return main.innerText.trim().length>20 && ![...main.querySelectorAll('[aria-busy="true"]')].some(visible);
  })()`)
}

export async function maskReviewDetails({ view }: ScreenshotContext): Promise<void> {
  // Screens explain the flow; real administrator addresses and connection
  // configuration do not belong in a published screenshot.
  await view.evaluate(`(() => {
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes)if(node.parentElement&&!['SCRIPT','STYLE'].includes(node.parentElement.tagName))node.textContent=node.textContent.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi,'reviewer@example.test');
    return true;
  })()`)
}

/** Read-only discovery of real seeded ids, never invented ids or database writes. */
export async function reviewFixtures(baseUrl: string): Promise<ScreenshotFixtures> {
  const now = new Date()
  const from = new Date(now.getTime() - 28 * 864e5).toISOString().slice(0, 10)
  const to = new Date(now.getTime() + 28 * 864e5).toISOString().slice(0, 10)
  const [calendar, products, athletes, library] = await Promise.all([
    readReview(baseUrl, `/api/health/calendar-week?from=${from}&to=${to}`),
    readReview(baseUrl, '/api/store/products'),
    readReview(baseUrl, '/api/coach/athletes', 'coach'),
    readReview(baseUrl, '/api/store/library', 'purchaserun').catch(() => []),
  ])
  const workouts = Object.values(calendar || {}).flat().filter((row: any) => row?.id && row.type !== 'metrics') as any[]
  const workout = workouts.find(row => !row.completed && row.has_steps) || workouts[0]
  const product = Array.isArray(products) ? products.find(row => row.slug === 'lsu-10k-einsteiger-run') || products[0] : null
  const athlete = Array.isArray(athletes) ? athletes[0] : athletes?.data?.[0]
  const coach = await reviewSession('coach', baseUrl)
  return {
    ...(workout ? { Workout: { id: workout.id } } : {}),
    ...(product ? { Product: { slug: product.slug, id: product.id } } : {}),
    ...(athlete ? { Athlete: { id: athlete.id } } : {}),
    ...(Array.isArray(library) && library[0]?.id ? { Purchase: { id: library[0].id } } : {}),
    Person: { id: String(coach.user.id) },
    Brand: { slug: 'last-soul-ultra' },
  }
}
