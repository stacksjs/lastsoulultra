/* eslint-disable no-console */
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

/** Check the actual BunPress artifact, including links and private-preview branding. */
const root = resolve('dist/docs/.bunpress')
const errors: string[] = []
let pages = 0
async function scan(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) { await scan(path); continue }
    if (!entry.name.endsWith('.html') || entry.name === '404.html') continue
    pages++
    const html = await Bun.file(path).text()
    if (!html.includes('Last Soul Ultra')) errors.push(`${path}: missing LSU title`)
    if (/HQ(?:\.training|[ -]powered)|powered by HQ|Copyright[^<]*Stacks|github\.com\/stacksjs|Stacks Documentation/i.test(html)) errors.push(`${path}: starter or platform branding leaked`)
    for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      const href = match[1]
      if (!href.startsWith('/') || href.startsWith('//')) continue
      const url = new URL(href, 'https://lsu.stacksjs.com')
      if (!url.pathname.startsWith('/docs/')) { errors.push(`${path}: link escapes docs mount: ${href}`); continue }
      const local = resolve(root, `.${url.pathname.slice('/docs'.length)}`)
      if (!await Bun.file(local).exists() && !await Bun.file(resolve(local, 'index.html')).exists()) errors.push(`${path}: missing linked artifact: ${href}`)
    }
  }
}
await scan(root)
const index = await Bun.file(resolve(root, 'search-index.json')).json()
if (!index) errors.push('Missing search index')
const reviewFile = Bun.file('docs/.data/demoAccounts.json')
if (await reviewFile.exists()) {
  const accounts = await reviewFile.json() as { email: string, password: string }[]
  if (accounts.length) {
    const demo = await Bun.file(resolve(root, 'demo/index.html')).text()
    if (accounts.length !== 12) errors.push('The protected review guide requires all twelve accounts')
    for (const account of accounts) {
      if (!demo.includes(account.email) || !demo.includes(account.password)) errors.push('A review login is missing from the protected walkthrough')
    }
    if (await Bun.file(resolve(root, '.data/demoAccounts.json')).exists()) errors.push('The private source data must not be copied into the docs artifact')
  }
}

if (errors.length) throw new Error(errors.join('\n'))
console.log(`Verified ${pages} LSU docs pages, mounted links, branding and search index.`)
