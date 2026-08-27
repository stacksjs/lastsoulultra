import { Action } from '@stacksjs/actions'
import { Subscriber } from '@stacksjs/orm'
import { rateLimit } from '@stacksjs/router'

/**
 * The second half of the double opt-in: the link in the confirmation mail.
 *
 * Answers HTML rather than JSON because a person clicks this from their inbox
 * and lands on it directly. That is the same shape the framework's
 * UnsubscribeAction uses, and it avoids bouncing the visitor between the API
 * host and the views host.
 *
 * Consent is only recorded here. Until this runs, the row sits at `pending`
 * and nothing is ever sent to it.
 */
export default new Action({
  name: 'ConfirmSubscriptionAction',
  description: 'Confirm a pending subscriber via the token in their opt-in email',
  method: 'GET',

  async handle(request: RequestInstance) {
    // The token is a UUID, so guessing is not the threat; scraped or replayed
    // links are. A throttle keeps that from becoming a way to enumerate.
    await rateLimit('email-confirm', 30).per('minute')

    const token = String(request.get('token') ?? '')

    if (!token)
      return page('That link is incomplete', 'The confirmation link is missing its token. Use the link in the email exactly as it arrived.', false)

    const subscriber = await Subscriber.where('uuid', token).first()

    if (!subscriber)
      return page('That link is not valid', 'This confirmation link is not one we issued, or the subscription has since been removed.', false)

    if (subscriber.status === 'unsubscribed')
      return page('You had unsubscribed', 'This address was unsubscribed. Sign up again from the site if you would like the updates back.', false)

    if (subscriber.status === 'subscribed')
      return page('Already confirmed', 'You are on the list. Nothing more to do.', true)

    await subscriber.update({ status: 'subscribed' })

    return page('You are on the list', 'That is the whole newsletter: a note when entries open, and a note when the race starts. Nothing else.', true)
  },
})

/**
 * A self-contained page in the site's colours. Inline styles because this is
 * served from the API host, which does not carry the site stylesheet.
 */
function page(title: string, body: string, ok: boolean): Response {
  const accent = '#f04800'
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} - Last Soul Ultra</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0c0c;color:#f4f4f2;font-family:ui-sans-serif,system-ui,sans-serif;padding:1.5rem">
  <main style="max-width:34rem">
    <p style="margin:0 0 1.25rem;font-family:ui-monospace,monospace;font-size:.6875rem;letter-spacing:.16em;text-transform:uppercase;color:${ok ? accent : '#8a8a86'}">
      ${ok ? 'confirmed' : 'not confirmed'}
    </p>
    <h1 style="margin:0;font-size:clamp(2rem,1.4rem+2.6vw,3rem);font-weight:800;line-height:.95;letter-spacing:-.015em;text-transform:uppercase">${escapeHtml(title)}.</h1>
    <p style="margin:1.5rem 0 0;font-size:1rem;line-height:1.65;color:#a5a5a1">${escapeHtml(body)}</p>
    <a href="/" style="display:inline-block;margin-top:2.25rem;padding:1rem 2rem;background:${accent};color:#0c0c0c;font-weight:700;font-size:.8125rem;letter-spacing:.08em;text-transform:uppercase;text-decoration:none">back to the race</a>
  </main>
</body>
</html>`

  return new Response(html, {
    // 200 either way: this is a person reading a page, not a client parsing a
    // result, and the outcome is stated in the copy.
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
