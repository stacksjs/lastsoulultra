/* eslint-disable no-console */
import { resolve, sep } from 'node:path'
import { compressResponse } from '@stacksjs/stx/compression'
import server from '../config/server'

/**
 * The same per-path headers the production server applies from
 * config/server.ts, matched the same way: `path/*` is a prefix, anything
 * else is exact. A preview that grants the microphone where production does
 * not is a preview that cannot find the bug, so this reads the one rule set
 * rather than keeping a second hard-coded origin beside it.
 */
function configuredHeaders(pathname: string): Record<string, string> {
  const matched: Record<string, string> = {}
  for (const [pattern, headers] of Object.entries(server.headers ?? {})) {
    const hit = pattern.endsWith('/*') ? pathname.startsWith(pattern.slice(0, -1)) : pathname === pattern
    if (hit) Object.assign(matched, headers)
  }
  return matched
}

const root = resolve('dist')
Bun.serve({ hostname: '127.0.0.1', port: 3942, async fetch(request) {
  const url = new URL(request.url)
  let pathname: string
  try { pathname = decodeURIComponent(url.pathname) }
  catch { return new Response('Bad request', { status: 400 }) }
  const name = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '').replace(/\/$/, '')
  let path = resolve(root, name)
  if (!path.startsWith(root + sep)) return new Response('Not found', { status: 404 })
  if (!name.split('/').pop()!.includes('.')) path += '.html'
  let file = Bun.file(path)
  let status = 200
  if (!await file.exists()) { file = Bun.file(resolve(root, '404.html')); status = 404 }
  const headers = { 'Cache-Control': 'no-store', ...configuredHeaders(pathname.replace(/(.)\/$/, '$1')) }
  return compressResponse(request, new Response(file, { status, headers }))
} })
console.log('LSU preview listening at http://localhost:3942')
