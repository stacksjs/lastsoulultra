import type { ScreenshotConfig } from '@stacksjs/docs/screenshots'
import inventory from '../resources/data/screens/inventory.json'
import { maskReviewDetails, previewProfile, screenReady } from '../scripts/screenshot-support'

export default {
  baseUrl: process.env.LSU_SCREENSHOT_SITE_ORIGIN || 'https://lsu.stacksjs.com',
  outDir: 'storage/runtime/docs-screen-captures/website',
  backend: 'chrome',
  timeoutMs: 45_000,
  models: false,
  inputs: ['resources/data/screens/inventory.json', 'scripts/screenshot-support.ts'],
  coverage: { directories: ['resources/views'] },
  profiles: { preview: { prepare: previewProfile } },
  redactEnv: ['SITE_AUTH_USER', 'SITE_AUTH_PASSWORD'],
  pages: inventory.screens.filter(screen => screen.group === 'website').map(screen => ({
    id: screen.id,
    title: screen.title,
    path: screen.path,
    description: screen.purpose,
    reason: screen.reason,
    sources: [screen.source],
    waitFor: 'main h1',
    ready: async context => {
      if (!await screenReady(context)) return false
      await maskReviewDetails(context)
      return true
    },
    ...('skip' in screen ? { skip: screen.skip } : {}),
  })),
} satisfies ScreenshotConfig
