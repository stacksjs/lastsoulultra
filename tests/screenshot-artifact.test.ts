import { expect, test } from 'bun:test'
import { openScreenshots, sealScreenshots } from '../scripts/screenshot-artifact'

test('screenshots are authenticated and encrypted before public CI upload', () => {
  const key = 'a-private-test-key-with-more-than-32-characters'
  const original = Buffer.from('synthetic reviewer image and private capture details')
  const sealed = sealScreenshots(original, key)
  expect(JSON.stringify(sealed)).not.toContain(original.toString())
  expect(openScreenshots(sealed, key)).toEqual(original)
  expect(sealScreenshots(original, key).ciphertext).not.toBe(sealed.ciphertext)
  expect(() => openScreenshots(sealed, 'another-private-test-key-of-32-characters')).toThrow()
  const changed = { ...sealed, ciphertext: Buffer.from('altered image').toString('base64') }
  expect(() => openScreenshots(changed, key)).toThrow()
  expect(() => openScreenshots({ ...sealed, nonce: '' }, key)).toThrow()
  expect(() => sealScreenshots(original, 'short')).toThrow()
})
