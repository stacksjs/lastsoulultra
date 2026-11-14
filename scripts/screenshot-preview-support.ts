import type { ScreenshotContext } from '@stacksjs/docs/screenshots'

/** Authenticate only requests sent to this preview origin, including initial navigation. */
export async function previewProfile({ view, baseUrl }: ScreenshotContext): Promise<void> {
  const username = process.env.SITE_AUTH_USER
  const password = process.env.SITE_AUTH_PASSWORD
  if (!username || !password) throw new Error('Preview credentials are required')
  await view.navigate('data:text/html,<title>Capture setup</title><main>Capture setup</main>')
  const origin = new URL(baseUrl).origin
  await view.cdp('Fetch.enable', { patterns: [{ urlPattern: `${origin}/*` }] })
  // Bun 1.4 WebView accepts one explicit CDP request at a time.
  let commands = Promise.resolve()
  view.addEventListener('Fetch.requestPaused', (event: Event) => {
    const { requestId, request } = (event as MessageEvent<any>).data
    const headers = Object.entries(request.headers || {}).filter(([name]) => name.toLowerCase() !== 'authorization').map(([name, value]) => ({ name, value: String(value) }))
    if (new URL(request.url).origin === origin) headers.push({ name: 'Authorization', value: `Basic ${btoa(`${username}:${password}`)}` })
    commands = commands.then(async () => { await view.cdp('Fetch.continueRequest', { requestId, headers }) }).catch(() => {})
  })
}
