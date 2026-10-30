# LSU enterprise installation

The race website and documentation stay at `lsu.stacksjs.com`. The complete
training application runs at `training.lsu.stacksjs.com`, from the same frozen
HQ application source used for the native apps. It owns its accounts and API.
Existing HQ accounts, sessions and athlete records are never copied or linked.

`./buddy deploy --prod --yes` prepares that source through the normal deploy
hook, checks each site's own migration corpus, provisions the declared PostgreSQL
database/role, deploys the services, reconciles Cloudflare A/AAAA records and TLS,
and starts the declared workers and scheduler. No hand-maintained server units,
gateway fragments or DNS record edits are needed.

CI fetches the immutable private HQ revision with `HQ_SOURCE_SSH_KEY`, a read-only
deploy key scoped to that source repository. The source helper verifies GitHub's
published host key and removes the temporary private-key file after fetching.
The key is excluded from dependency installation and native build environments.

The deployment requires fresh Hetzner evidence for Germany (`DE`), Falkenstein
(`fsn1`). A missing credential, unknown location or other location stops it.
Buddy provisions LSU's dedicated host in that location. It does not attach to
the shared Stacks host, whose global backup policy copies data outside Germany.
Off-host recovery copies are explicitly confined to a private `fsn1` bucket,
encrypted with a separate recovery key and scheduled by Buddy. The application
services do not receive backup credentials. See `enterprise/RECOVERY.md` for
the restore procedure and verification requirements. External integrations
require their own explicit configuration.
The native release checks `/api/deployment` for the expected installation, origin,
source revision and residency metadata before building or uploading.

Backend services opt out of inherited deployment environment variables. Only
explicit installation credentials reach them. They run under a project Unix
identity with a filesystem namespace exposing their own release and project
shared data, private temporary storage and no access to upstream PostgreSQL
Unix sockets. PostgreSQL access uses LSU's own role over authenticated loopback.
Buddy enforces SCRAM password authentication for loopback SQL and replication;
an owned-host guard prevents applying that host-wide policy to another tenant's server.
Uploads and speech data stay under this project's persistent directory.
The private speech service has its own token, model/runtime directory and port.
Buddy installs the pinned FFmpeg decoder into this installation's shared media
runtime and exposes it to the API and workers; it never relies on another app's tools.
Deployment records its library environment beside the tenant launcher, which
loads it before invoking HQ's normal launcher. Runtime services need no privileged Pantry CLI.
Cloud inference, remote object storage, telemetry and integration credentials
are not inherited from HQ. An external provider needs its own reviewed setup.
These controls describe this installation; they do not certify legal compliance.

TestFlight releases use the manually dispatched `TestFlight` GitHub workflow on
`main`, with Xcode 27.1 (27A9275). Native generation runs before signing secrets
are available. Signing credentials belong to the `ios-testflight` environment;
the job removes its temporary keychain and profiles and saves only the signed
IPA and public source receipts. Production backend credentials are not supplied
to this job. A local upload requires the same released Xcode build.

Store these values using `buddy env:set KEY --stdin --file .env.production`:

- `CLOUDFLARE_API_TOKEN` and optional `CLOUDFLARE_ZONE_ID` for automated DNS.
- `LSU_TRAINING_APP_KEY` and `LSU_TRAINING_DB_PASSWORD`, distinct from HQ and the website.
- `LSU_DEMO_ACCOUNTS_JSON`, strong generated passwords for the synthetic review users.

The website keeps its SQLite settings and password protection. The training
backend uses `lsu_training` and its own key. Authenticated APIs enforce the same
application authorization logic as HQ over LSU's independent data. Standard
public authentication and catalog endpoints remain available for the app.
The documented fake training is seeded idempotently only into the explicit LSU
database; passwords and edits are preserved. Provider-backed payments and real
athlete records are not manufactured or imported.

LSU's brand preset and coaching tiers (`enterprise/presets.json`), its
onboarding decisions and the preview/acceptance history formerly kept in HQ are
described in `enterprise/hq-acceptance.md`.
