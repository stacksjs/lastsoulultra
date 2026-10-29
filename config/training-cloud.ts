import type { CloudConfig } from '@stacksjs/ts-cloud'
import deployment from '../enterprise/deployment.json'
import source from '../native/hq-source.json'

/** Resolve secrets when cloud config is evaluated, including Buddy's production reload. */
export function trainingSites(): NonNullable<CloudConfig['sites']> {
  const root = `storage/native/hq/${source.revision}`
  const shared = deployment.storageRoot
  const secrets = process.env
  const runtime = {
    HOST: '127.0.0.1', APP_ENV: 'production', NODE_ENV: 'production',
    APP_NAME: 'Last Soul Ultra', APP_URL: deployment.origin, APP_DOMAIN: new URL(deployment.origin).hostname,
    HQ_NATIVE_PRODUCT: 'deployment/lsu/product.json',
    HQ_SOURCE_REVISION: source.revision,
    FRONTEND_APP_URL: deployment.origin, STX_PUBLIC_API_URL: `${deployment.origin}/api`,
    API_URL: `http://127.0.0.1:${deployment.ports.api}`, PORT_API: String(deployment.ports.api),
    APP_KEY: secrets.LSU_TRAINING_APP_KEY || '',
    DB_CONNECTION: 'postgres', DB_HOST: deployment.database.host, DB_PORT: String(deployment.database.port),
    DB_DATABASE: deployment.database.name, DB_USERNAME: deployment.database.user, DB_PASSWORD: secrets.LSU_TRAINING_DB_PASSWORD || '',
    STORAGE_DRIVER: 'bun', STORAGE_ROOT: shared, STORAGE_PUBLIC_URL: deployment.origin,
    QUEUE_DRIVER: 'database', HQ_SCHEDULER: 'off', HQ_PAGE_WARMUP: 'off', TYPESENSE_ENABLED: 'false', SEED_DEMO_DATA: 'false',
    MAIL_MAILER: 'log', COACHING_SPEECH_PROVIDER: 'local', COACHING_SPEECH_PORT: String(deployment.ports.speech),
    COACHING_SPEECH_RUNTIME_DIR: `${shared}/speech`, COACHING_SPEECH_TOKEN_FILE: `${shared}/speech/token`,
    COACHING_SPEECH_URL: `http://127.0.0.1:${deployment.ports.speech}/v1`, COACHING_SPEECH_MODEL: 'whisper-1',
  }
  const install = ['sh scripts/install-release-runtime.sh', 'export PATH=$PWD/.hq-runtime/bin:$PATH', 'sh scripts/install-release-dependencies.sh']
  const common = {
    root, inheritEnv: false, isolation: true, keepReleases: 2,
    exclude: ['.hq-runtime', 'storage/framework/mobile', 'storage/logs', 'storage/app', 'build', '.claude'],
    sharedPaths: [{ path: 'storage/app', target: `${shared}/storage/app` }, { path: 'enterprise-data', target: shared }],
  }

  return {
    training: {
      ...common, domain: new URL(deployment.origin).hostname, path: '/', port: deployment.ports.web,
      start: './scripts/start-production.sh storage/framework/runtime/production/serve.js',
      healthCheck: { path: '/login' }, env: runtime,
      preStart: [...install, 'mkdir -p storage/framework/runtime/production', 'bun scripts/build-production.ts web'],
    },
    'training-api': {
      ...common, port: deployment.ports.api,
      start: './scripts/start-production.sh storage/framework/runtime/production/api.js',
      backgroundBun: '.hq-runtime/bin/bun',
      env: { ...runtime, LSU_DEMO_ACCOUNTS_JSON: secrets.LSU_DEMO_ACCOUNTS_JSON || '', LSU_SEED_DATABASE: deployment.database.name, LSU_SEED_CONFIRM: 'last-soul-ultra' },
      healthCheck: { path: '/api/deployment' },
      preStart: [...install, './buddy migrate --no-generate --auth', './buddy queue:table', 'mkdir -p storage/framework/runtime/production', 'bun scripts/build-production.ts api', 'bun deployment/lsu/seed-review.ts', 'sh scripts/ensure-speech-runtime.sh'],
      scheduler: true,
      daemons: [
        {name:'coaching-jobs',command:'./scripts/start-production.sh node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=default --concurrency=1'},
        {name:'garmin-sync',command:'./scripts/start-production.sh node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=garmin-direct --concurrency=1'},
        {name:'exercise-media',command:'./scripts/start-production.sh node_modules/@stacksjs/ts-cloud/dist/bin/stacks-queue-worker.js --queue=exercise-media --concurrency=1'},
        {name:'local-speech',command:'sh scripts/start-local-speech.sh',restart:'on-failure'},
      ],
    },
  }
}
