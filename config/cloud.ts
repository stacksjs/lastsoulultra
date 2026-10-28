import type { CloudConfig } from '@stacksjs/types'
import type { CloudConfig as TsCloudConfig } from '@stacksjs/ts-cloud'
import { env } from '@stacksjs/env'

/**
 * The slug names the files this deploy OWNS on the box:
 * `/etc/rpx/sites.d/<slug>.json` and the `rpx-cert-renew-<slug>.*` units. The
 * fragment is replaced wholesale, so a slug colliding with another tenant's
 * silently takes over its routes and TLS. It must be unique across every
 * project attached to this box, and must never equal `attachTo`.
 */
const APP_SLUG = 'lastsoulultra'
const APP_DOMAIN = env.APP_DOMAIN || 'lsu.stacksjs.com'

/**
 * Ports on the shared box.
 *
 * Read from a live `ss -lntp`, not from another project's config: those list
 * what a project declares, not what is bound, and they miss any tenant not
 * checked out locally. Two services CAN bind one port here, so a collision
 * shows up as two domains serving each other's site half the time.
 *
 * 3200/3201 were free on 2026-08-27; 3190/3191 are rappid's, the highest
 * neighbour before that.
 */
const PORT_MAIN = 3200
const PORT_API = 3201

export const tsCloud: TsCloudConfig = {
  project: { name: APP_SLUG, slug: APP_SLUG, region: 'us-east-1' },

  stateDir: 'storage/cloud',

  cloud: {
    provider: 'hetzner',
    // The owner project's slug. Without this, ts-cloud finds no server
    // labelled `ts-cloud/project=lastsoulultra` and quietly provisions a NEW
    // box, which is an expensive way to discover a missing line.
    attachTo: 'stacks',
  },

  mode: 'server',

  environments: {
    production: {
      type: 'production',
      deployBranch: 'main',
      region: 'us-east-1',
      variables: { APP_ENV: 'production', NODE_ENV: 'production', LOG_LEVEL: 'info' },
    },
  },

  infrastructure: {
    compute: {
      instances: 1,
      size: 'small',
      disk: { size: 20, type: 'ssd', encrypted: true },
      // Without `webServer: 'rpx'` the gateway step is gated off entirely: the
      // deploy prints "App deployed", writes no route, and the domain never
      // resolves to anything.
      webServer: 'rpx',
      proxy: { engine: 'rpx', onDemandTls: true },
    },

    /**
     * No `dns` block, so the deploy writes no records and needs no registrar
     * credentials.
     *
     * `stacksjs.com` is delegated to Cloudflare nameservers (confirmed against
     * the .com root and three public resolvers) while a Route53 hosted zone
     * for the same name also exists and is not the one being asked - so which
     * credentials would even be the right ones was not a settled question.
     * `lsu.stacksjs.com` is one host that will not move, so its A and AAAA are
     * created once by hand, pointing at the shared `stacks` box this project
     * attaches to:
     *
     *   lsu  A     178.105.248.188
     *   lsu  AAAA  2a01:4f8:c014:6186::1
     *
     * The same pair `hq.training` resolves to. Not proxied: rpx terminates TLS
     * on the box with on-demand certificates, and a proxy in front would
     * terminate it somewhere else and break the issuance.
     */
  },

  sites: {
    /**
     * The race site. Every page renders from the typed modules in
     * `resources/data`, so nothing here needs a database at request time; the
     * API exists because the app declares API routes and an unserved `/api/**`
     * answers 502.
     */
    main: {
      root: '.',
      path: '/',
      domain: APP_DOMAIN,
      /**
       * Behind HTTP Basic auth: this is a preview of a site that is already
       * live elsewhere, so it must not be read by the public or indexed by a
       * crawler. rpx challenges every request to the route until the
       * credentials are given, the same way the nginx driver applies an
       * htpasswd file.
       *
       * Credentials come from the environment, never from this file - a
       * password in the repository is a password on every fork and in every
       * clone. Set SITE_AUTH_USER and SITE_AUTH_PASSWORD and the gate turns
       * itself on; leave them unset and the site is open, which is the right
       * default for the day it goes public.
       *
       * On the deploy they come from GitHub repository secrets of the same
       * two names, passed through in `.github/workflows/deploy.yml`. That is
       * deliberate: a password set there can be rotated from the GitHub UI
       * without the dotenvx private key and without a commit, which matters
       * for the one value most likely to be shared and then changed.
       * `.env.production` works too and wins locally.
       */
      ...(env.SITE_AUTH_USER && env.SITE_AUTH_PASSWORD
        ? { auth: { username: env.SITE_AUTH_USER, password: env.SITE_AUTH_PASSWORD, realm: 'Last Soul Ultra preview' } }
        : {}),
      start: 'bun node_modules/@stacksjs/buddy/dist/serve-entry.js',
      port: PORT_MAIN,
      // Build-time-only source art would go here if there were any; the race
      // photography is served from the organiser's own CDN, so the release
      // carries no images at all.
      preStart: [
        'echo "[lastsoulultra] preStart: install"',
        'bun install --frozen-lockfile',
        'echo "[lastsoulultra] preStart: migrate"',
        'bun node_modules/@stacksjs/buddy/dist/cli.js migrate',
        'echo "[lastsoulultra] preStart: done"',
      ],
      env: {
        APP_ENV: 'production',
        NODE_ENV: 'production',
        APP_URL: `https://${APP_DOMAIN}`,
        PORT_API: String(PORT_API),
        API_URL: `http://127.0.0.1:${PORT_API}`,
      },
    },

    /** Loopback only: no `domain`, so rpx skips it and the firewall keeps the
     *  port off the public network. */
    api: {
      root: '.',
      start: 'bun node_modules/@stacksjs/actions/dist/serve/api.js',
      port: PORT_API,
      // No migrate here: `main` owns the schema, and running two migrations
      // against one shared database is how a deploy races itself.
      preStart: ['bun install --frozen-lockfile'],
      env: {
        HOST: '127.0.0.1',
        APP_ENV: 'production',
        NODE_ENV: 'production',
        APP_URL: `https://${APP_DOMAIN}`,
      },
    },
  },
}

const config: CloudConfig = {}

export default config
