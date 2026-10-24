import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Static assets for the Stacks site. All application styles are maintained in resources/. */
for (const name of await readdir('resources/assets/styles/site')) {
  if (!name.endsWith('.css')) continue
  await Bun.write(name === 'stx-site.css' ? 'public/assets/styles/stx-site.css' : join('public/assets/styles/production', name), Bun.file(join('resources/assets/styles/site', name)))
}
await Bun.write('public/assets/styles/ts-maps.css', Bun.file('node_modules/@ts-maps/stx/dist/styles.css'))
