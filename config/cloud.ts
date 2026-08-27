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
const APP_DOMAIN = env.APP_DOMAIN || 'lastsoulultra.hq.training'

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
     * `lastsoulultra.hq.training` sits in the `hq.training` zone at Porkbun.
     * The address pass is opt-in on `provider` being set: it derives one A and
     * one AAAA per site domain and upserts them, never deleting anything else
     * in a zone this project does not own. `domain` names the ZONE.
     */
    dns: { provider: 'porkbun', domain: 'hq.training' },
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
