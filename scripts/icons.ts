/**
 * Generate the raster favicons from the same two colours as public/favicon.svg.
 *
 * An SVG favicon covers current browsers, but Safari before 16.4 ignores it and
 * an iOS home-screen bookmark wants a 180px PNG, so declaring only an SVG
 * leaves those with the browser's blank glyph. Written by hand rather than
 * pulled from an image library: the mark is two rectangles, and encoding it
 * directly avoids adding a dependency to draw a square.
 *
 *   bun run scripts/icons.ts
 */

const PAGE: [number, number, number] = [0x0C, 0x0C, 0x0C] // --page
const ACCENT: [number, number, number] = [0xF0, 0x48, 0x00] // --accent

/** CRC-32, which PNG requires on every chunk. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1))
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/** Adler-32, which the zlib container checks the payload against. */
function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

/**
 * PNG's IDAT holds a zlib stream (RFC 1950), not bare deflate. Bun.deflateSync
 * returns the raw deflate blocks - first byte 0x63, no 0x78 header - so the
 * container has to be added by hand. Without it `file` still reports a valid
 * PNG from the IHDR alone while every decoder fails on the pixel data.
 */
function zlibWrap(raw: Uint8Array): Uint8Array {
  const deflated = Bun.deflateSync(raw)
  const out = new Uint8Array(2 + deflated.length + 4)
  out[0] = 0x78 // CM = deflate, CINFO = 32K window
  out[1] = 0x01 // FCHECK so (0x78 << 8 | 0x01) % 31 === 0, no preset dictionary
  out.set(deflated, 2)
  new DataView(out.buffer).setUint32(2 + deflated.length, adler32(raw))
  return out
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const body = new Uint8Array(typeBytes.length + data.length)
  body.set(typeBytes)
  body.set(data, typeBytes.length)

  // 4 length + (4 type + data) + 4 CRC. Allocating 8 here instead of 4 left
  // four trailing zero bytes on every chunk: `file` still read the header, but
  // the stream was corrupt.
  const out = new Uint8Array(4 + body.length + 4)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(body, 4)
  view.setUint32(4 + body.length, crc32(body))
  return out
}

/**
 * The mark: a page-coloured field with the wordmark's orange full stop, drawn
 * as a square to match the display face's squared terminals. The inset is a
 * fraction so it lands on the same proportions at any size.
 */
function png(size: number): Uint8Array {
  const inset = Math.round(size * 9 / 32)
  const end = size - inset

  // One filter byte (0 = None) then RGB triples, per scanline.
  const raw = new Uint8Array(size * (1 + size * 3))
  let at = 0
  for (let y = 0; y < size; y++) {
    raw[at++] = 0
    for (let x = 0; x < size; x++) {
      const on = x >= inset && x < end && y >= inset && y < end
      const [r, g, b] = on ? ACCENT : PAGE
      raw[at++] = r
      raw[at++] = g
      raw[at++] = b
    }
  }

  const ihdr = new Uint8Array(13)
  const head = new DataView(ihdr.buffer)
  head.setUint32(0, size)
  head.setUint32(4, size)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  // 10-12 stay 0: deflate, adaptive filtering, no interlace.

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibWrap(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]

  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

if (import.meta.main) {
  const targets: Array<[string, number]> = [
    ['public/favicon-32.png', 32],
    ['public/apple-touch-icon.png', 180],
  ]

  for (const [path, size] of targets) {
    const bytes = png(size)
    await Bun.write(path, bytes)
    console.log(`wrote ${path} (${size}x${size}, ${bytes.length} bytes)`)
  }
}
