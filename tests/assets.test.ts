import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * public/assets/lsu/asset-integrity.json records where each self-hosted photo,
 * logo and font came from and what it hashed to on the day it was captured.
 * That is a provenance claim, and nothing was checking it: an asset could be
 * replaced, or quietly re-encoded by a tool, and the record would still say it
 * matched production.
 */
const record = await Bun.file(resolve('public/assets/lsu/asset-integrity.json')).json()

test('every captured asset is byte-identical to what was recorded from production', async () => {
  const captured = record.assets.filter((asset: any) => asset.local)
  expect(captured.length).toBeGreaterThan(90)

  const wrong: string[] = []
  for (const asset of captured) {
    const path = resolve('public', asset.local.replace(/^\//, ''))
    if (!existsSync(path)) { wrong.push(`${asset.local}: missing`); continue }
    const bytes = new Uint8Array(await Bun.file(path).arrayBuffer())
    if (bytes.byteLength !== asset.bytes) { wrong.push(`${asset.local}: ${asset.bytes} bytes recorded, ${bytes.byteLength} on disk`); continue }
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== asset.sha256) wrong.push(`${asset.local}: sha256 differs`)
  }
  expect(wrong).toEqual([])
})

test('the record names where it came from and when', () => {
  expect(record.sourceOrigin).toBe('https://www.lastsoulultra.com')
  expect(record.capturedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  // One asset 404'd at capture. It is kept with its error rather than dropped,
  // so the gap stays visible instead of looking like it was never wanted.
  const failed = record.assets.filter((asset: any) => !asset.local)
  for (const asset of failed) expect(asset.error).toBeTruthy()
})
