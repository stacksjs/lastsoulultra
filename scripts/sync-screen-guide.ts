/** Keep the authored UI inventory, template coverage and atlas in agreement. */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import inventory from '../resources/data/screens/inventory.json'
import source from '../native/hq-source.json'

const check = process.argv.includes('--check')
const root = process.cwd()
const groups = {
  account: ['Account and onboarding', 'Sign-in, consent, the welcome tour and account preferences. Start with the [onboarding guide](/onboarding) for the complete first-run sequence.'],
  training: ['Daily training screens', 'Daily training, session details and recorded progress. A screen can be empty when the account has no approved training or recorded activity.'],
  health: ['Health and device screens', 'Measurements, supported connections and optional recovery practices. No chart is expected before its source has supplied data.'],
  purchases: ['Coaching and purchase screens', 'The Store, purchased content, subscriptions and checkout returns. Provider-backed purchases and complimentary review access are different records.'],
  messages: ['Messages and sharing screens', 'Conversations, notifications and deliberate sharing choices. Confirm the participant and account before composing or publishing.'],
  coach: ['Coach screens', 'Authoring, athlete context and weekly review. A coach profile and the appropriate roster or method access are required. Read the [coach guide](/coaches) before editing or approving work.'],
  organization: ['Organization screens', 'Operational screens depend on organization permissions. Some tools belong to the shared platform and are useful only when LSU enables the relevant service. Read [Administration](/administration).'],
  shared: ['Shared and conditional screens', 'The pinned kit includes routes outside the LSU athlete journey and screens requiring a particular published profile, hardware or one-use link. Each is accounted for here. An explained exclusion is not a claim of visual verification.'],
  website: ['Race website screens', 'The protected race website explains the event and opens the separate race-entry service. A training login does not authenticate a race-entry Profile.'],
} as const
const ids = new Set<string>()
const sources = new Set<string>()
for (const screen of inventory.screens) {
  if (ids.has(screen.id)) throw new Error(`Duplicate screen id ${screen.id}`)
  ids.add(screen.id)
  if (!(screen.group in groups) || !screen.title || !screen.purpose || !screen.reason || !screen.guide || !screen.profile) throw new Error(`Incomplete screen explanation: ${screen.id}`)
  await readFile(join(root, screen.source))
  sources.add(screen.source)
}
for (const directory of ['resources/views', 'pantry/@hq/platform/source/resources/views']) {
  for await (const path of new Bun.Glob('**/*.stx').scan({ cwd: join(root, directory), onlyFiles: true })) {
    if (!sources.has(`${directory}/${path}`)) throw new Error(`Undocumented UI template: ${directory}/${path}`)
  }
}
const cell = (value: string): string => value.replaceAll('|', '\\|').replaceAll('\n', ' ')
const pages = new Map<string, string>()
for (const [group, [title, introduction]] of Object.entries(groups)) {
  const screens = inventory.screens.filter(screen => screen.group === group)
  pages.set(`docs/screens/${group}.md`, `---\ntitle: ${title}\ndescription: The purpose, rationale, entry route and review context for each ${group} screen.\n---\n\n<!-- Generated from resources/data/screens/inventory.json by scripts/sync-screen-guide.ts. -->\n\n# ${title}\n\n${introduction}\n\n${screens.length} template-backed screens in this section. The source snapshot is HQ kit ${source.version}. Names and visibility can vary by account, language and enabled Experience.\n\n${screens.map(screen => `## ${screen.title}\n\n${screen.purpose}\n\n**Why this screen exists:** ${screen.reason}\n\n| Entry | Review context | Full guide |\n| --- | --- | --- |\n| \`${cell(screen.path)}\` | ${cell(screen.profile)} | [Read the guide](${screen.guide}) |\n\n${'skip' in screen ? `**Capture scope:** ${screen.skip}\n\n` : ''}${screen.path.includes('[') ? 'This is a route pattern. Open a real synthetic fixture from its parent list; do not type a placeholder id or publish a private sharing token.\n\n' : ''}`).join('')}[Return to the screen atlas](/screens/)\n`)
}
const index = `---
title: Screen atlas
description: Find every documented LSU and shared-kit screen, understand its purpose and review the capture coverage.
---

# Screen atlas

Use this atlas when you know the screen you want to understand. Use [Getting started](/getting-started) for your first session and [Onboarding](/onboarding) for the complete first-run sequence. The atlas explains each screen's job and why it exists; the linked guides explain the surrounding workflow.

The inventory accounts for **${inventory.screens.length} source templates**: **${inventory.screens.filter(screen => screen.group === 'website').length} race-website templates** and **${inventory.screens.filter(screen => screen.group !== 'website').length} templates in the pinned training kit**. This counts template-backed screens, not every possible tab, dialog, record, translation or error state. The kit includes shared-platform screens beyond the LSU athlete journey. Their conditional or excluded status is explained rather than silently treated as reviewed.

## Choose a section

| Section | What it explains |
| --- | --- |
${Object.entries(groups).map(([group, [title]]) => `| [${title}](/screens/${group}) | ${inventory.screens.filter(screen => screen.group === group).length} template-backed screens |`).join('\n')}

## Read a screen in context

Check the signed-in account, selected workspace and subscription before following an action. An administrator's visible tools are not a runner's entitlement. An empty chart can mean there is no connected data; an empty future week can mean feedback or coach approval is still due. A failed request should offer a visible explanation, not pretend the account has no records.

The current LSU iPhone navigation is Today, Week, Exercises, Backyard and Me. Health is a top shortcut; Progress and Workouts are under More. Store and Calendar have their own top controls. Native screens reuse much of the same view source, but a phone-width browser capture verifies only the web rendering. Check the installed app separately for native controls, permissions, hardware and return links.

## Capture and maintenance

The authored inventory is the coverage source for screenshot automation. Every template needs a documented screen or a specific reason it is outside capture scope. Dynamic routes require synthetic seeded records, and one-use links require a dedicated fixture. Never make up record ids or reuse a real person's authorization token to fill a gap.

[The capture workflow](/screens/automation) explains the reusable Stacks command, roles, fixtures, output and review checks. [Review ideas](/review-ideas) records potential improvements separately from the behavior shipped today. [Payment testing](/payment-testing) explains sandbox checkout states and error scenarios.

The coverage audit checks template inventory and generated prose. It does not mean every listed conditional route has been visually captured, and it does not replace behavioral tests.
`
pages.set('docs/screens/index.md', index)
const art = ['athlete-today-dark.webp', 'athlete-calendar-dark.webp', 'coach-roster-dark.webp']
for (const file of art) {
  const bytes = await readFile(join(root, 'native/onboarding', file))
  const target = join(root, 'docs/public/onboarding', file)
  if (check) {
    if (!bytes.equals(await readFile(target))) throw new Error(`Stale onboarding picture: ${file}`)
  }
  else { await mkdir(join(root, 'docs/public/onboarding'), { recursive: true }); await writeFile(target, bytes) }
}
for (const [file, text] of pages) {
  if (check) {
    if (await readFile(join(root, file), 'utf8') !== text) throw new Error(`Stale screen guide: ${file}`)
  }
  else { await mkdir(join(root, 'docs/screens'), { recursive: true }); await writeFile(join(root, file), text) }
}
// A removed section must not linger as a seemingly current generated reference.
for (const file of await readdir(join(root, 'docs/screens'))) {
  if (['automation.md'].includes(file)) continue
  if (!pages.has(`docs/screens/${file}`)) throw new Error(`Unlisted screen reference: ${file}`)
}
console.log(`${check ? 'Verified' : 'Generated'} ${inventory.screens.length} documented UI templates and ${art.length} branded onboarding pictures.`)
