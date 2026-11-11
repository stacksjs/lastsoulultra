/* eslint-disable no-console */
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { siteStyleToken } from '../config/style-guide'

/** Check the actual BunPress artifact, including links and private-preview branding. */
const root = resolve('dist/docs/.bunpress')
const errors: string[] = []
let pages = 0
let brandedPages = 0
const cssValue = (name: string, value: string) => new RegExp(`${name}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`)
async function scan(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) { await scan(path); continue }
    if (!entry.name.endsWith('.html') || entry.name === '404.html') continue
    pages++
    const html = await Bun.file(path).text()
    if (!html.includes('Last Soul Ultra')) errors.push(`${path}: missing LSU title`)
    if (/HQ(?:\.training|[ -]powered)|powered by HQ|Copyright[^<]*Stacks|github\.com\/stacksjs|Stacks Documentation/i.test(html)) errors.push(`${path}: starter or platform branding leaked`)
    // Standalone component specimens have their own document and CSP. Every
    // BunPress page must ship the actual LSU shell, not just a branded title.
    const specimen = html.includes('Content-Security-Policy" content="default-src \'none\'')
    const diagram = /<meta name="generator" content="archify [^"]+">/.test(html)
    if (!specimen && !diagram) {
      brandedPages++
      if (!/<html[^>]*class="[^"]*\bdark\b/.test(html) || !html.includes('data-theme-mode="dark"')) errors.push(`${path}: LSU appearance was not server rendered`)
      if (!/class="BPNavBarTitle-logo"[^>]*src="\/docs\/style-guide\/lsu-logo\.svg"/.test(html)) errors.push(`${path}: missing production wordmark`)
      if (!/--bp-font-family-base\s*:\s*["']?Barlow/.test(html) || !/--bp-font-family-mono\s*:\s*["']?Share Tech Mono/.test(html) || !/font-family\s*:\s*["']?Anton/.test(html)) errors.push(`${path}: missing production typefaces`)
      if (!cssValue('--bp-c-brand-3', siteStyleToken('--lsu-red')).test(html) || !cssValue('--bp-c-bg', siteStyleToken('--lsu-black')).test(html)) errors.push(`${path}: docs palette differs from production`)
      if (!html.includes('href="/docs/favicon.png"') || !html.includes('https://lsu.stacksjs.com/docs/style-guide/lsu-social-card.png')) errors.push(`${path}: missing LSU browser or social identity`)
    }
    for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      const href = match[1]
      if (!href.startsWith('/') || href.startsWith('//')) continue
      const url = new URL(href, 'https://lsu.stacksjs.com')
      if (!url.pathname.startsWith('/docs/')) {
        // A real navigation specimen retains application destinations. Those
        // links are not docs assets; the BunPress shell must stay mounted.
        if (specimen && match[0].startsWith('href=')) continue
        errors.push(`${path}: link escapes docs mount: ${href}`)
        continue
      }
      const local = resolve(root, `.${url.pathname.slice('/docs'.length)}`)
      if (!await Bun.file(local).exists() && !await Bun.file(resolve(local, 'index.html')).exists()) errors.push(`${path}: missing linked artifact: ${href}`)
    }
  }
}
await scan(root)
if (!brandedPages) errors.push('No branded BunPress pages were audited')
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
console.log(`Verified ${pages} LSU docs pages, ${brandedPages} branded BunPress shells, mounted links, production assets and search index.`)
