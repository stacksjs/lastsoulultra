# Application configuration

These typed files configure the LSU website and its deployment. Read each file's comments and the relevant framework skill before changing an option.

| File | LSU responsibility |
| --- | --- |
| [`coaching.ts`](coaching.ts) | Independent training origin and published brand slug |
| [`server.ts`](server.ts) | Website headers, proxies and redirects to private training screens |
| [`docs.ts`](docs.ts) | Guide navigation, LSU theme and `/docs` build mount |
| [`style-guide.ts`](style-guide.ts) | Source-derived component reference and brand tokens |
| [`cloud.ts`](cloud.ts) | Dedicated host, website/docs services, preview gate and backups |
| [`training-cloud.ts`](training-cloud.ts) | Training web/API runtime isolation, migrations, workers and credentials |
| [`database.ts`](database.ts) | Website database settings, separate from the training database |

For example, changing `HQ_ORIGIN` changes where the website reads the public brand and sends training links. It does not retarget an already packaged native app; that origin belongs to [`native/product.json`](../native/product.json).

Keep actual secrets in the private environment or encrypted `.env.production`, not in these configuration files. Use `./buddy env:set KEY --stdin --file .env.production` for encrypted values. Config modules can load before Buddy switches environment, so follow the existing runtime secret-resolution pattern in `training-cloud.ts` when adding deployment credentials.

See [setup and verification](../README.md) and [enterprise operations](../enterprise/README.md).
