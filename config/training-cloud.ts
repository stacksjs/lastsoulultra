import type { CloudConfig } from '@stacksjs/ts-cloud'
import { readFileSync } from 'node:fs'
import deployment from '../enterprise/deployment.json'
import source from '../native/hq-source.json'

/** Resolve secrets when cloud config is evaluated, including Buddy's production reload. */
export function trainingSites(): NonNullable<CloudConfig['sites']> {
  const root = `storage/native/hq/${source.revision}`
  const shared = deployment.storageRoot
  const secrets = process.env
  const mediaLauncher = readFileSync(new URL('../enterprise/start-training.sh', import.meta.url), 'utf8').trimEnd()
  const launcher = `/bin/sh ${shared}/media/start-training.sh`
  // A queue worker runs one job at a time and needs a connection or two, not
  // the ten a web process may. Ten long-lived processes at ten each filled
  // Postgres' 100 slots and locked the deploy out of its own database, so the
  // workers cap their pools (honoured by @stacksjs/database 0.75.525 and later).
  const worker = `/usr/bin/env DB_POOL_MAX=2 ${launcher}`
  const runtime = {
    HOST: '127.0.0.1', APP_ENV: 'production', NODE_ENV: 'production',
    APP_NAME: 'Last Soul Ultra', APP_URL: deployment.origin, APP_DOMAIN: new URL(deployment.origin).hostname,
    HQ_NATIVE_PRODUCT: 'deployment/lsu/product.json',
    HQ_SOURCE_REVISION: source.revision,
    FRONTEND_APP_URL: deployment.origin, STX_PUBLIC_API_URL: `${deployment.origin}/api`,
    API_URL: `http://127.0.0.1:${deployment.ports.api}`, PORT_API: String(deployment.ports.api),
    APP_KEY: secrets.LSU_TRAINING_APP_KEY || '',
    // Provider sign-ins return here, and to this origin's pages, not HQ's defaults.
    OAUTH_REDIRECT_BASE: deployment.origin, FRONTEND_URL: deployment.origin,
    // HQ platform: Continue with HQ, and devices connected through HQ's provider apps.
    HQ_PLATFORM_ISSUER: 'https://hq.training', HQ_PLATFORM_DATA_MODE: 'proxy', HQ_PLATFORM_CLIENT_ID: secrets.LSU_HQ_PLATFORM_CLIENT_ID || '',
    HQ_PLATFORM_CLIENT_SECRET: secrets.LSU_HQ_PLATFORM_CLIENT_SECRET || '', HQ_PLATFORM_RELAY_SECRET: secrets.LSU_HQ_PLATFORM_RELAY_SECRET || '',
    APNS_TEAM_ID: secrets.LSU_APNS_TEAM_ID || '', APNS_KEY_ID: secrets.LSU_APNS_KEY_ID || '', APNS_PRIVATE_KEY: secrets.LSU_APNS_PRIVATE_KEY || '',
    APNS_TOPIC: 'com.lastsoulultra.app', APNS_ENVIRONMENT: 'production',
    APPLE_TEAM_ID: secrets.LSU_APPLE_TEAM_ID || '', APPLE_KEY_ID: secrets.LSU_APPLE_KEY_ID || '', APPLE_PRIVATE_KEY: secrets.LSU_APPLE_PRIVATE_KEY || '',
    // Sign in with Apple and Google in a browser. The app draws both buttons;
    // each works once its values are set: Apple's Services ID beside the key
    // above, and a Google web OAuth client. Empty leaves that provider off.
    APPLE_CLIENT_ID: secrets.LSU_APPLE_CLIENT_ID || '',
    GOOGLE_CLIENT_ID: secrets.LSU_GOOGLE_CLIENT_ID || '', GOOGLE_CLIENT_SECRET: secrets.LSU_GOOGLE_CLIENT_SECRET || '',
    DB_CONNECTION: 'postgres', DB_HOST: deployment.database.host, DB_PORT: String(deployment.database.port),
    DB_DATABASE: deployment.database.name, DB_USERNAME: deployment.database.user, DB_PASSWORD: secrets.LSU_TRAINING_DB_PASSWORD || '',
    STORAGE_DRIVER: 'bun', STORAGE_ROOT: shared, STORAGE_PUBLIC_URL: deployment.origin,
    PATH: `${shared}/media/pantry/.bin:/opt/pantry/pantry/.bin:/usr/local/bin:/usr/bin:/bin`,
    QUEUE_DRIVER: 'database', HQ_SCHEDULER: 'off', HQ_PAGE_WARMUP: 'off', TYPESENSE_ENABLED: 'true', SEED_DEMO_DATA: 'false',
    TYPESENSE_HOST: '127.0.0.1', TYPESENSE_PORT: '8108', TYPESENSE_PROTOCOL: 'http', TYPESENSE_API_KEY: secrets.LSU_TYPESENSE_API_KEY || '',
    MAIL_MAILER: 'smtp', MAIL_DOMAIN: new URL(deployment.origin).hostname,
    MAIL_HOST: `mail.${new URL(deployment.origin).hostname}`, MAIL_PORT: '587', MAIL_ENCRYPTION: 'tls',
    MAIL_USERNAME: `hello@${new URL(deployment.origin).hostname}`, MAIL_PASSWORD: secrets.LSU_MAIL_PASSWORD || '',
    MAIL_FROM_NAME: 'Last Soul Ultra', MAIL_FROM_ADDRESS: `hello@${new URL(deployment.origin).hostname}`,
    // The installation's own AI key: every coach's method feedback runs on it (HQ's key for now).
    ANTHROPIC_API_KEY: secrets.LSU_ANTHROPIC_API_KEY || '',
    COACHING_SPEECH_PROVIDER: 'local', COACHING_SPEECH_PORT: String(deployment.ports.speech),
    COACHING_SPEECH_RUNTIME_DIR: `${shared}/speech`, COACHING_SPEECH_TOKEN_FILE: `${shared}/speech/token`,
    COACHING_SPEECH_URL: `http://127.0.0.1:${deployment.ports.speech}/v1`, COACHING_SPEECH_MODEL: 'whisper-1',
  }
  const install = ['sh scripts/install-release-runtime.sh', 'export PATH=$PWD/.hq-runtime/bin:$PATH', 'sh scripts/install-release-dependencies.sh', `mkdir -p ${shared}/media`, `printf '%s\\n' '{"dependencies":{"ffmpeg.org":"9.0.2"}}' > ${shared}/media/pantry.json`, `(cd ${shared}/media && pantry install --no-save)`]
  install.push(`(umask 077; cd ${shared}/media && pantry env > runtime-env.sh && chmod 600 runtime-env.sh)`, `cat > ${shared}/media/start-training.sh <<'LSU_MEDIA_START'\n${mediaLauncher}\nLSU_MEDIA_START`, `(. ${shared}/media/runtime-env.sh && ffmpeg -version >/dev/null)`)
  const common = {
    root, inheritEnv: false, isolation: true, keepReleases: 2,
    exclude: ['.hq-runtime', 'storage/framework/mobile', 'storage/logs', 'storage/app', 'build', '.claude'],
    sharedPaths: [{ path: 'storage/app', target: `${shared}/storage/app` }, { path: 'enterprise-data', target: shared }],
  }

  // The API owns migrations and index readiness; promote it before the web process.
  return {
    'training-api': {
      ...common, port: deployment.ports.api,
      start: `${launcher} storage/framework/runtime/production/api.js`,
      // Scheduler admission selects the native binary, rather than Pantry's shell launcher.
      backgroundBun: `.hq-runtime/pantry/bun.com/v${source.bun}/bin/bun`,
      env: { ...runtime, LSU_DEMO_ACCOUNTS_JSON: secrets.LSU_DEMO_ACCOUNTS_JSON || '', LSU_SEED_DATABASE: deployment.database.name, LSU_SEED_CONFIRM: 'last-soul-ultra' },
      healthCheck: { path: '/api/deployment' },
      preStart: [...install, './buddy migrate --no-generate --auth', './buddy queue:table', 'bun scripts/enterprise-preflight.ts --platform', 'bun scripts/reindex-public-profiles.ts', 'mkdir -p storage/framework/runtime/production', 'bun scripts/build-production.ts api', 'bun deployment/lsu/seed-review.ts', './buddy installation:admins', 'bun deployment/lsu/grant-trainer-plans.ts', 'sh scripts/ensure-speech-runtime.sh'],
      scheduler: true,
      daemons: [
        // The catch-all queue, and a gym's webhook deliveries, as HQ's own deploy runs them.
        {name:'coaching-jobs',command:`${worker} node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=default,webhooks --concurrency=1`},
        // Wind-down reminders, in-app pushes and notification deliveries, and emails: the queues HQ's own deploy gives a worker.
        {name:'notifications',command:`${worker} node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=notifications,emails --concurrency=1`},
        // Device syncs and provider events HQ relays.
        {name:'connection-sync',command:`${worker} node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=connection-sync,connection-events --concurrency=1`},
        // HQ profile, history, relay receipts and cleanup stay responsive during long device syncs.
        {name:'hq-platform',command:`${worker} node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=platform-history --concurrency=1`},
        {name:'garmin-sync',command:`${worker} node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=garmin-direct --concurrency=1`},
        {name:'exercise-media',command:`${worker} node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=exercise-media --concurrency=1`},
        // The kit's bounded profile-index rebuilds and request-retention batches.
        {name:'search-maintenance',command:`${worker} node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=search,maintenance --concurrency=1`},
        {name:'local-speech',command:`/usr/bin/env COACHING_SPEECH_RUNTIME_DIR=${runtime.COACHING_SPEECH_RUNTIME_DIR} ${launcher} --local-speech`,restart:'on-failure'},
      ],
    },
    training: {
      ...common, domain: new URL(deployment.origin).hostname, path: '/', port: deployment.ports.web,
      aliases: [`mail.${new URL(deployment.origin).hostname}`],
      start: `${launcher} storage/framework/runtime/production/serve.js`,
      healthCheck: { path: '/login' }, env: runtime,
      preStart: [...install, 'mkdir -p storage/framework/runtime/production', 'bun scripts/build-production.ts web'],
    },
  }
}
