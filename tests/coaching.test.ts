import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import coaching from '../config/coaching'
import { publicCheckoutReceipt } from '../resources/functions/coaching-return'

async function portal(section: string, receipt: string) {
  return processDirectives(`<CoachingPortal section="${section}" />`, { query: { hq_subscription: receipt } }, resolve('resources/views/coaching.stx'), {
    enabled: true, cache: false, componentsDir: resolve('resources/components'),
  }, new Set())
}

test('the static LSU component composes HQ without freezing a visitor receipt into the build', async () => {
  const html = await portal('calendar', '12')
  expect(html.includes(`src="${new URL(coaching.origin).origin}/assets/elements/hq-coaching.js"`)).toBe(true)
  expect(html).toContain(`brand="${coaching.brand}"`)
  expect(html).toContain('section="calendar" :subscription="coachingSubscription"')
  expect(html).not.toContain('subscription="12"')
  expect(html).toContain(':order="coachingOrder"')
  expect(html).not.toContain('order="12"')
  expect(html).toContain(`/brands/${coaching.brand}`)
})

test('the LSU component refuses arbitrary sections and credential-like return data', async () => {
  const html = await portal('other', '12&token=private')
  expect(html).toContain('section="" :subscription="coachingSubscription"')
  expect(html).not.toContain('private')
})

test('runtime receipt hints accept only bounded public numeric identifiers', () => {
  expect(publicCheckoutReceipt('12')).toBe('12')
  for (const value of ['12&token=private', 'https://other.invalid/12', '1'.repeat(17), undefined, { token: 'private' }])
    expect(publicCheckoutReceipt(value)).toBe('')
})
