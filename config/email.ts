import type { EmailConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'
import deployment from '../enterprise/deployment.json'

export default {
  from: {
    name: 'Last Soul Ultra',
    address: `hello@${new URL(deployment.origin).hostname}`,
  },

  domain: new URL(deployment.origin).hostname,
  mailboxes: [],
  forwards: {},
  url: env.APP_URL || 'lastsoulultra.localhost',
  charset: 'UTF-8',

  server: {
    // The dedicated host's mail service and DKIM keys belong to this installation.
    enabled: true,
    scan: true,
    subdomain: 'mail',
  },
} satisfies EmailConfig
