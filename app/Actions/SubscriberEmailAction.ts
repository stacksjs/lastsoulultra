import { Action } from '@stacksjs/actions'
import { isUniqueViolation, Subscriber, SubscriberEmail } from '@stacksjs/orm'
import { rateLimit } from '@stacksjs/router'
import { sendSubscriptionOptIn } from '../Mail/SubscriptionOptIn'

/**
 * Overrides the framework's SubscriberEmailAction to make this a real double
 * opt-in.
 *
 * The default creates the row as `subscribed` and sends a welcome note. That
 * is single opt-in, and this site's privacy policy states Double-Opt-In, which
 * under the GDPR has to be the truth rather than the intention. So the row is
 * created `pending`, nothing is mailed to that address afterwards, and only
 * clicking the link in the opt-in mail promotes it to `subscribed`.
 *
 * Responses never reveal whether an address is already on the list. Saying
 * "already subscribed" turns the form into an oracle anyone can use to test
 * whether a given person entered this race.
 */
export default new Action({
  name: 'SubscriberEmailAction',
  description: 'Record a pending subscriber and send the double opt-in confirmation',
  method: 'POST',

  async handle(request: RequestInstance) {
    // The endpoint is unauthenticated and skipCsrf'd, so bots will find it.
    await rateLimit('email-subscribe', 10).per('minute')

    const email = String(request.get('email') ?? '').trim().toLowerCase()
    const source = request.get('source') || 'footer'
    // The footer form carries this so a browser posting the form directly -
    // no JavaScript - lands on a readable page instead of a wall of JSON.
    // The client-side enhancement omits it and reads the JSON.
    const wantsHtml = request.get('format') === 'html'

    // Deliberately loose: the confirmation mail is the real validator. A
    // stricter regex here only ever rejects addresses that turn out to work.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return reply(wantsHtml, false, 'That address does not look right', 'Enter an email address we can reach you at, then try again.')

    const existing = await Subscriber.where('email', email).first()

    if (existing?.status === 'subscribed') {
      // Already confirmed. Same shape as a fresh signup so the response does
      // not disclose it.
      return reply(wantsHtml, true, 'Check your inbox', 'If that address is not already confirmed, a confirmation email is on its way. Click the link in it to finish.')
    }

    let subscriber = existing

    if (!subscriber) {
      try {
        subscriber = await Subscriber.create({ email, status: 'pending', source })
      }
      catch (err) {
        // Two requests for the same address can both miss the lookup above and
        // race into the unique index. The loser re-reads the winner's row.
        if (!isUniqueViolation(err))
          throw err
        subscriber = await Subscriber.where('email', email).first()
        if (!subscriber)
          throw err
      }
    }

    await SubscriberEmail.create({ email, source })

    try {
      // Awaited, unlike the framework default's fire-and-forget. If the
      // confirmation cannot be delivered there is nothing for the subscriber
      // to click, and telling them to check an inbox that will stay empty is
      // worse than telling them it failed.
      await sendSubscriptionOptIn({ to: email, subscriberUuid: subscriber.uuid })
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Failed to send the opt-in email to ${email}:`, message)
      return reply(wantsHtml, false, 'That did not send', 'We could not send the confirmation email just now. Please try again shortly.')
    }

    return reply(wantsHtml, true, 'Check your inbox', 'A confirmation email is on its way. Click the link in it and you are on the list.')
  },
})

/** JSON for the fetch path, a readable page for a plain form post. */
function reply(html: boolean, success: boolean, title: string, message: string): any {
  if (!html)
    return { success, message }

  const accent = '#f04800'
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} - Last Soul Ultra</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0c0c;color:#f4f4f2;font-family:ui-sans-serif,system-ui,sans-serif;padding:1.5rem">
  <main style="max-width:34rem">
    <p style="margin:0 0 1.25rem;font-family:ui-monospace,monospace;font-size:.6875rem;letter-spacing:.16em;text-transform:uppercase;color:${success ? accent : '#8a8a86'}">newsletter</p>
    <h1 style="margin:0;font-size:clamp(2rem,1.4rem+2.6vw,3rem);font-weight:800;line-height:.95;letter-spacing:-.015em;text-transform:uppercase">${title}.</h1>
    <p style="margin:1.5rem 0 0;font-size:1rem;line-height:1.65;color:#a5a5a1">${message}</p>
    <a href="/" style="display:inline-block;margin-top:2.25rem;padding:1rem 2rem;background:${accent};color:#0c0c0c;font-weight:700;font-size:.8125rem;letter-spacing:.08em;text-transform:uppercase;text-decoration:none">back to the race</a>
  </main>
</body>
</html>`

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
