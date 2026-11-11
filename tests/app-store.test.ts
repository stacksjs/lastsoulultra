import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { processDirectives } from '@stacksjs/stx'
import { appStoreListed } from '../resources/data/app-stores'

async function appPage(): Promise<string> {
  const path = resolve('resources/views/app.stx')
  return processDirectives(await Bun.file(path).text(), {}, path, {
    enabled: true,
    cache: false,
    componentsDir: resolve('resources/components'),
    layoutsDir: resolve('resources/layouts'),
    partialsDir: resolve('resources/partials'),
  }, new Set())
}

describe('the App Store on the app page', () => {
  test('counts as listed only once a listing is configured', () => {
    expect(appStoreListed(undefined)).toBe(false)
    expect(appStoreListed('  ')).toBe(false)
    expect(appStoreListed('https://apps.apple.com/app/id1234567890')).toBe(true)
  })

  test('is not offered while the only address is a search for the name', async () => {
    // This repository configures no listing, so this is the page as deployed.
    expect(appStoreListed()).toBe(false)
    const html = await appPage()

    expect(html).not.toContain('apps.apple.com')
    expect(html).not.toContain('Download on the App Store')
    expect(html).toContain('Open it on the web')
    expect(html).toContain('In testing on TestFlight')
  })
})
