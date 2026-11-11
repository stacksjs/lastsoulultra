import type { StyleGuideConfig } from '@stacksjs/docs/style-guide'
import { styleGuideCssTokens } from '@stacksjs/docs/style-guide'
import { readFileSync } from 'node:fs'

// Public site branding is deliberately independent of the embedded training
// service's account state. This is the stylesheet shipped by build:assets.
const base = readFileSync(new URL('../resources/assets/styles/site/base.css', import.meta.url), 'utf8')
const variables = styleGuideCssTokens(base)
/** The docs shell and its component specimens read the same production tokens. */
export function siteStyleToken(name: string): string {
  const token = variables.find(token => token.name === name)
  if (!token) throw new Error(`Missing production style token: ${name}`)
  return token.value
}
const value = siteStyleToken

export default {
  brand: {
    name: 'Last Soul Ultra',
    description: 'Production components and interface patterns for the World Series, race entries and training portal.',
    accent: value('--lsu-red'),
    background: value('--lsu-black'),
    foreground: value('--lsu-white'),
    font: value('--lsu-body'),
    principles: [
      'Use the active site tokens: red for the primary action, black surfaces, white text and square action shapes.',
      'Anton sets display headings, Barlow sets readable interface copy, and Share Tech Mono sets supporting numbers.',
      'Keep decorative race typography away from long form labels and body copy. Preserve visible focus and clear input labels.',
      'Website fixtures use local fictional data. Embedded training screens retain their service-owned identity and authorization.',
      'The shared training inventory is a source reference. It does not claim that account-connected modules were executed in these previews.',
    ],
  },
  sources: [
    { id: 'site', label: 'Website', directory: 'resources/components' },
    { id: 'training', label: 'Shared training', directory: 'pantry/@hq/platform/source/resources/components' },
    { id: 'ui', label: 'Shared UI', directory: 'node_modules/@stacksjs/components/src/ui' },
  ],
  stories: ['resources/style-guide'],
  tokens: {
    'Colors and surfaces': variables.filter(token => !/font|display|body|mono|seg$|pad-|max|gap/.test(token.name)),
    'Typography': variables.filter(token => /display|body|mono|seg$/.test(token.name)),
    'Layout': variables.filter(token => /pad-|max|gap/.test(token.name)),
  },
  styles: {
    files: [
      'resources/assets/styles/site/base.css',
      'resources/assets/styles/site/stx-site.css',
      'resources/assets/styles/site/profile.css',
      'resources/assets/styles/site/coaching.css',
      'resources/assets/styles/site/results.css',
    ],
  },
  preview: { componentDirs: ['resources/components'] },
  output: { publicUrl: '/docs/style-guide/generated' },
} satisfies StyleGuideConfig
