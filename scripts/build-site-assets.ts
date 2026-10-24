import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Static assets for the Stacks site. All application styles are maintained in resources/. */
for (const name of await readdir('resources/assets/styles/site')) {
  if (!name.endsWith('.css')) continue
  await Bun.write(name === 'stx-site.css' ? 'public/assets/styles/stx-site.css' : join('public/assets/styles/production', name), Bun.file(join('resources/assets/styles/site', name)))
}
await Bun.write('public/assets/styles/ts-maps.css', Bun.file('node_modules/@ts-maps/stx/dist/styles.css'))

// Keep the homepage's small race summary derived from the full official results.
const story: Record<string, unknown> = {}
for (const year of [2025, 2026]) {
  const source = await Bun.file(`resources/data/results-${year}.json`).json()
  const maxYards = Math.max(...source.results.map((row: { yards: number }) => Number(row.yards)))
  story[year] = { maxYards, loopMetres: source.event.loop_metres, startersByYard: Array.from({ length: maxYards }, (_, index) => source.results.filter((row: { yards: number }) => Number(row.yards) >= index + 1).length) }
}
await Bun.write('resources/data/race-story.json', `${JSON.stringify(story, null, 2)}\n`)
