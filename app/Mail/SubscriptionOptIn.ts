import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'
import { url } from '@stacksjs/router'

export interface SubscriptionOptInOptions {
  to: string
  subscriberUuid: string
}

/**
 * Ask a new subscriber to confirm, and do not add them to anything until they
 * do.
 *
 * The framework default sends a "Welcome" note with an unsubscribe link and
 * marks the row `subscribed` on the spot. That is single opt-in. This is a
 * German race with a German privacy policy that states Double-Opt-In, and
 * under the GDPR that statement has to be true: consent is only recorded once
 * the person clicks the link in this mail.
 *
 * The subscriber's UUID is the token. It is unguessable, it is already unique
 * per row, and it is the same token the unsubscribe route accepts - so a
 * single value covers both ends of the lifecycle.
 */
export async function sendSubscriptionOptIn(options: SubscriptionOptInOptions): Promise<void> {
  const { to, subscriberUuid } = options

  const appName = config.app.name || 'Last Soul Ultra'
  const confirmUrl = url('email.confirm', { token: subscriberUuid })
  const unsubscribeUrl = url('email.unsubscribe', { token: subscriberUuid })

  const { html, text } = await template('subscription-opt-in', {
    variables: {
      email: to,
      confirmUrl,
      unsubscribeUrl,
      appName,
    },
    subject: `Confirm your ${appName} updates`,
  })

  // sendOrFail rather than send: a confirmation nobody receives leaves the
  // subscriber stuck as `pending` forever, and the caller needs to know that
  // happened so it can tell them rather than claiming success.
  await mail.sendOrFail({
    to: [to],
    from: {
      name: config.email.from?.name || appName,
      address: config.email.from?.address || 'no-reply@lastsoulultra.com',
    },
    subject: `Confirm your ${appName} updates`,
    html,
    text,
  })
}

export default sendSubscriptionOptIn
