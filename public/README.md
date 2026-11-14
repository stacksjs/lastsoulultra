# Static website assets

Files here are served at the website root. For example, `public/assets/lsu/images/lsu-logo.svg` is available as `/assets/lsu/images/lsu-logo.svg`. The private preview gate applies at the deployment gateway; it does not turn this directory into per-user private storage.

`assets/lsu/` contains the self-hosted race imagery, logos and fonts. Preserve the provenance and hashes in `asset-integrity.json` when changing captured brand assets. Generated style assets are produced by `bun run build:assets`; commit their output with source changes.

`bun scripts/seo.ts` writes the site's sitemap and robots files. Use `SITE_ORIGIN` when generating for a different canonical origin. The documentation has a separate `docs/public/` asset directory, mounted under `/docs` by BunPress.

Do not place passwords, private account data or authenticated uploads here. Training uploads belong to the training installation's private storage and authorized serving routes. See [enterprise storage](../enterprise/README.md).
