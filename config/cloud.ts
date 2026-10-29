import type { CloudConfig } from '@stacksjs/types'
import type { CloudConfig as TsCloudConfig } from '@stacksjs/ts-cloud'
import { env } from '@stacksjs/env'
import { trainingSites } from './training-cloud'
import deployment from '../enterprise/deployment.json'
import source from '../native/hq-source.json'

/**
 * The slug names the files this deploy OWNS on the box:
 * `/etc/rpx/sites.d/<slug>.json` and the `rpx-cert-renew-<slug>.*` units. The
 * fragment is replaced wholesale, so the project always owns its own routes.
 * LSU provisions a dedicated host: a shared host's global backups must never
 * collect enterprise training data outside the declared residency policy.
 */
const APP_SLUG = 'lastsoulultra'
const APP_DOMAIN = env.APP_DOMAIN || 'lsu.stacksjs.com'

/**
 * Stable loopback ports, reached only through this host's rpx gateway.
 */
const PORT_MAIN = 3200
const PORT_API = 3201
const WEBSITE_STORAGE = '/var/www/lastsoulultra-shared/website'

export const tsCloud: TsCloudConfig = {
  project: { name: APP_SLUG, slug: APP_SLUG, region: deployment.residency.location },

  stateDir: 'storage/cloud',

  cloud: {
    provider: 'hetzner',
    residency: { countries: [deployment.residency.country], locations: [deployment.residency.location] },

    /**
     * Where this site used to answer.
     *
     * The deploy refuses to replace an rpx fragment that still serves a
     * domain the config no longer declares, which is the right instinct - it
     * is the difference between moving a site and silently taking one down.
     * Naming the old host here is how you say the takedown is deliberate.
     *
     * It was only ever a preview, on a subdomain of the coaching platform
     * rather than of this race, and it answered without a password. Leaving
     * it up alongside a gated lsu.stacksjs.com would have left the open door
     * open.
     */
    retiredDomains: ['lastsoulultra.hq.training'],
  },

  hetzner: { location: deployment.residency.location },

  mode: 'server',

  environments: {
    production: {
      type: 'production',
      deployBranch: 'main',
      region: deployment.residency.location,
      variables: { APP_ENV: 'production', NODE_ENV: 'production', LOG_LEVEL: 'info' },
    },
  },

  infrastructure: {
    appDatabase: { engine: 'postgres', name: deployment.database.name, username: deployment.database.user, password: process.env.LSU_TRAINING_DB_PASSWORD || '', host: deployment.database.host, port: deployment.database.port, requireLocalPasswordAuth: true },
    dns: { domain: APP_DOMAIN },
    compute: {
      runtime: 'bun',
      runtimeVersion: source.bun,
      managedServices: { postgres: true },
      instances: 1,
      // Available x86 capacity in fsn1; the private speech runtime requires x86.
      size: 'cpx32',
      disk: { size: 20, type: 'ssd', encrypted: true },
      // Without `webServer: 'rpx'` the gateway step is gated off entirely: the
      // deploy prints "App deployed", writes no route, and the domain never
      // resolves to anything.
      webServer: 'rpx',
      proxy: { engine: 'rpx', onDemandTls: true },
    },

    // Cloudflare is authoritative for stacksjs.com. Buddy reconciles every
    // declared site's A/AAAA records as DNS-only so rpx can issue its TLS cert.
  },

  sites: {
    ...trainingSites(),
    docs: {
      deploy: 'server',
      root: 'dist/docs/.bunpress',
      path: '/docs',
      domain: APP_DOMAIN,
      build: './buddy build --docs',
      pathRewriteStyle: 'directory',
      ...(env.SITE_AUTH_USER && env.SITE_AUTH_PASSWORD
        ? { auth: { username: env.SITE_AUTH_USER, password: env.SITE_AUTH_PASSWORD, realm: 'Last Soul Ultra preview' } }
        : {}),
    },

    /**
     * The race site. Every page renders from the typed modules in
     * `resources/data`, so nothing here needs a database at request time; the
     * API exists because the app declares API routes and an unserved `/api/**`
     * answers 502.
     */
    main: {
      root: '.',
      inheritEnv: false,
      isolation: true,
      sharedPaths: [{ path: 'website-data', target: WEBSITE_STORAGE }],
      exclude: ['storage/runtime', 'storage/native', 'storage/framework/mobile'],
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
       * itself on. The deploy hook requires both for this private preview.
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
        `mkdir -p ${WEBSITE_STORAGE}/database`,
        'bun node_modules/@stacksjs/buddy/dist/cli.js migrate',
        'echo "[lastsoulultra] preStart: done"',
      ],
      env: {
        APP_KEY: process.env.APP_KEY || '',
        APP_ENV: 'production',
        NODE_ENV: 'production',
        APP_URL: `https://${APP_DOMAIN}`,
        HQ_ORIGIN: deployment.origin, HQ_BRAND_SLUG: 'last-soul-ultra',
        PORT_API: String(PORT_API),
        API_URL: `http://127.0.0.1:${PORT_API}`,
        DB_CONNECTION: 'sqlite', DB_DATABASE: 'stacks', DB_USERNAME: '', DB_PASSWORD: '',
        DB_DATABASE_PATH: `${WEBSITE_STORAGE}/database/stacks.sqlite`,
      },
    },

    /** Loopback only: no `domain`, so rpx skips it and the firewall keeps the
     *  port off the public network. */
    api: {
      root: '.',
      inheritEnv: false,
      isolation: true,
      sharedPaths: [{ path: 'website-data', target: WEBSITE_STORAGE }],
      exclude: ['storage/runtime', 'storage/native', 'storage/framework/mobile'],
      start: 'bun node_modules/@stacksjs/actions/dist/serve/api.js',
      port: PORT_API,
      // No migrate here: `main` owns the schema, and running two migrations
      // against one shared database is how a deploy races itself.
      preStart: ['bun install --frozen-lockfile'],
      env: {
        APP_KEY: process.env.APP_KEY || '',
        HOST: '127.0.0.1',
        APP_ENV: 'production',
        NODE_ENV: 'production',
        APP_URL: `https://${APP_DOMAIN}`,
        HQ_ORIGIN: deployment.origin, HQ_BRAND_SLUG: 'last-soul-ultra',
        DB_CONNECTION: 'sqlite', DB_DATABASE: 'stacks', DB_USERNAME: '', DB_PASSWORD: '',
        DB_DATABASE_PATH: `${WEBSITE_STORAGE}/database/stacks.sqlite`,
      },
    },
  },
}

const config: CloudConfig = {}

export default config
