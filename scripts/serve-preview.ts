/* eslint-disable no-console */
import { resolve, sep } from 'node:path'
import { compressResponse } from '@stacksjs/stx/compression'

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
  return compressResponse(request, new Response(file, { status, headers: { 'Cache-Control': 'no-store', 'Permissions-Policy': 'microphone=(self "http://localhost:3940")' } }))
} })
console.log('LSU preview listening at http://localhost:3942')
