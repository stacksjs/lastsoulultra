import type { StyleGuideConfig } from '@stacksjs/docs/style-guide'
import { styleGuideCssTokens } from '@stacksjs/docs/style-guide'
import { readFileSync } from 'node:fs'
import product from '../native/product.json'

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
    description: 'Application components, training interfaces and shared controls for Last Soul Ultra.',
    accent: value('--lsu-red'),
    background: value('--lsu-black'),
    foreground: value('--lsu-white'),
    font: 'Inter, system-ui, sans-serif',
    principles: [
      'Use the active site tokens: red for the primary action, black surfaces, white text and rounded app actions.',
      'Anton sets app headings and Inter sets readable application copy. Barlow is the documentation reading face.',
      'Keep condensed display typography away from long form labels and body copy. Preserve visible focus and clear input labels.',
      'App specimens use local fictional data. Account screens retain their service-owned identity and authorization.',
      'The shared training inventory is a source reference. It does not claim that account-connected modules were executed in these previews.',
    ],
  },
  sources: [
    { id: 'training', label: 'Shared training', directory: 'pantry/@hq/platform/source/resources/components', exclude: ['marketing-*.stx'] },
    { id: 'ui', label: 'Shared UI', directory: 'node_modules/@stacksjs/components/src/ui' },
  ],
  stories: ['resources/style-guide'],
  tokens: {
    'App colors and surfaces': Object.entries(product.identity.theme).filter(([key]) => ['background', 'surface', 'text', 'muted', 'accent', 'accent_text', 'border'].includes(key)).map(([name, value]) => ({ name, value: String(value) })),
    'App typography': [{ name: 'Headings', value: 'Anton' }, { name: 'Reading and controls', value: 'Inter' }],
    'App corners': [{ name: 'Actions', value: `${product.identity.theme.radius}px` }, { name: 'Cards', value: `${product.identity.theme.card_radius}px` }],
  },
  styles: {
    files: [
      'resources/assets/styles/site/base.css',
      'resources/assets/styles/site/stx-site.css',
      'resources/assets/styles/site/coaching.css',
    ],
  },
  preview: { componentDirs: ['pantry/@hq/platform/source/resources/components'] },
  output: { publicUrl: '/docs/style-guide/generated' },
} satisfies StyleGuideConfig
