/** Encrypt unreviewed screenshots before uploading artifacts from this public repository. */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { resolveEnvPrivateKey } from '@stacksjs/env'

interface Envelope { format: 1, salt: string, nonce: string, tag: string, ciphertext: string }
const purpose = 'lastsoulultra/docs-screenshots/v1'
function artifactKey(secret: string, salt: Uint8Array): Buffer {
  if (secret.length < 32) throw new Error('The configured production decryption key is required')
  return Buffer.from(hkdfSync('sha256', secret, salt, purpose, 32))
}
export function sealScreenshots(archive: Uint8Array, secret: string): Envelope {
  const salt = randomBytes(32)
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', artifactKey(secret, salt), nonce)
  cipher.setAAD(Buffer.from(purpose))
  const ciphertext = Buffer.concat([cipher.update(archive), cipher.final()])
  return { format: 1, salt: salt.toString('base64'), nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }
}
export function openScreenshots(envelope: Envelope, secret: string): Buffer {
  if (envelope.format !== 1) throw new Error('Unsupported screenshot artifact format')
  const salt = Buffer.from(envelope.salt, 'base64')
  const nonce = Buffer.from(envelope.nonce, 'base64')
  const tag = Buffer.from(envelope.tag, 'base64')
  if (salt.length !== 32 || nonce.length !== 12 || tag.length !== 16) throw new Error('Invalid screenshot artifact envelope')
  const decipher = createDecipheriv('aes-256-gcm', artifactKey(secret, salt), nonce)
  decipher.setAAD(Buffer.from(purpose))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()])
}
if (import.meta.main) {
  const [mode, input, output] = process.argv.slice(2)
  if (!['seal', 'open'].includes(mode || '') || !input || !output) throw new Error('Use seal <capture-directory> <encrypted.json> or open <encrypted.json> <review.tar>')
  const secret = resolveEnvPrivateKey({ file: '.env.production', cwd: process.cwd() })
  if (!secret) throw new Error('The production environment decryption key is required')
  if (mode === 'seal') {
    const archive = spawnSync('tar', ['-cf', '-', '-C', resolve(input), '.'], { maxBuffer: 256 * 1024 * 1024 })
    if (archive.status !== 0) throw new Error('The capture directory could not be archived')
    await writeFile(output, JSON.stringify(sealScreenshots(archive.stdout, secret)), { mode: 0o600, flag: 'wx' })
  }
  else await writeFile(output, openScreenshots(JSON.parse(await readFile(input, 'utf8')), secret), { mode: 0o600, flag: 'wx' })
  console.log(mode === 'seal' ? 'Encrypted the screenshot review bundle' : 'Decrypted the screenshot review archive')
}
