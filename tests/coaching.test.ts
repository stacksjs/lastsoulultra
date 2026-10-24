import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import coaching from '../config/coaching'

async function portal(section: string, receipt: string) {
  return processDirectives(`<CoachingPortal section="${section}" />`, { query: { hq_subscription: receipt } }, resolve('resources/views/coaching.stx'), {
    enabled: true, cache: false, componentsDir: resolve('resources/components'),
  }, new Set())
}

test('the LSU component composes an HQ section and returns its public subscription receipt', async () => {
  const html = await portal('calendar', '12')
  expect(html.includes(`src="${new URL(coaching.origin).origin}/assets/elements/hq-coaching.js"`)).toBe(true)
  expect(html).toContain(`brand="${coaching.brand}"`)
  expect(html).toContain('section="calendar" subscription="12"')
  expect(html).toContain(`/brands/${coaching.brand}`)
})

test('the LSU component refuses arbitrary sections and credential-like return data', async () => {
  const html = await portal('other', '12&token=private')
  expect(html).toContain('section="" subscription=""')
  expect(html).not.toContain('private')
})
