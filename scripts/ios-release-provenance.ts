/** Provenance belongs to the uploaded artifact, independent of later checkout pins. */
export interface IosBuildProvenance {
  schemaVersion: 1
  platform: 'ios'
  app: string
  version: string
  build: number
  hqPlatform: string
  hqRevision: string
  hqLockSha256: string
  productSha256: string
  lsuRevision: string
  builtAt: string
}

export interface IosUploadReceipt {
  schemaVersion: 2 | null
  app: string
  version: string
  build: number
  ipaSha256: string
  uploadedAt: string
  /** Old uploads did not retain this evidence; never infer it from today's checkout. */
  provenance: IosBuildProvenance | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Invalid iOS release receipt')
  return value
}

function text(value: unknown, name: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || !value || (pattern && !pattern.test(value))) throw new Error(`Invalid iOS release ${name}`)
  return value
}

function buildNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid iOS release build')
  return value
}

function timestamp(value: unknown, name: string): string {
  const date = text(value, name)
  if (!Number.isFinite(Date.parse(date))) throw new Error(`Invalid iOS release ${name}`)
  return date
}

const commit = /^[a-f0-9]{40}$/
const sha256 = /^[a-f0-9]{64}$/

export function readIosBuildProvenance(value: unknown): IosBuildProvenance {
  const row = record(value)
  if (row.schemaVersion !== 1 || row.platform !== 'ios') throw new Error('Invalid iOS build provenance schema or platform')
  return {
    schemaVersion: 1, platform: 'ios', app: text(row.app, 'app'), version: text(row.version, 'version'), build: buildNumber(row.build),
    hqPlatform: text(row.hqPlatform, 'platform kit', /^@hq\/platform@\d+\.\d+\.\d+$/), hqRevision: text(row.hqRevision, 'HQ source', commit),
    hqLockSha256: text(row.hqLockSha256, 'HQ lock hash', sha256), productSha256: text(row.productSha256, 'product hash', sha256),
    lsuRevision: text(row.lsuRevision, 'LSU source', commit), builtAt: timestamp(row.builtAt, 'build time'),
  }
}

export function createIosUploadReceipt(value: unknown, ipaSha256: string, expected: { app: string, version: string, build: number, hqRevision: string, productSha256: string }): IosUploadReceipt {
  const provenance = readIosBuildProvenance(value)
  if (provenance.app !== expected.app || provenance.version !== expected.version || provenance.build !== expected.build
    || provenance.hqRevision !== expected.hqRevision || provenance.productSha256 !== expected.productSha256)
    throw new Error('The iOS build provenance does not match the release inputs')
  return { schemaVersion: 2, app: provenance.app, version: provenance.version, build: provenance.build, ipaSha256: text(ipaSha256, 'IPA hash', sha256), uploadedAt: new Date().toISOString(), provenance }
}

export function readIosUploadReceipt(value: unknown): IosUploadReceipt {
  const row = record(value)
  if (row.schemaVersion !== undefined && row.schemaVersion !== 2) throw new Error('Unsupported iOS upload receipt schema')
  const provenance = row.provenance == null ? null : readIosBuildProvenance(row.provenance)
  const result: IosUploadReceipt = { schemaVersion: row.schemaVersion === 2 ? 2 : null, app: text(row.app, 'app'), version: text(row.version, 'version'), build: buildNumber(row.build), ipaSha256: text(row.ipaSha256, 'IPA hash', sha256), uploadedAt: timestamp(row.uploadedAt, 'upload time'), provenance }
  if (provenance && (provenance.app !== result.app || provenance.version !== result.version || provenance.build !== result.build))
    throw new Error('The upload receipt and build provenance identify different binaries')
  if (result.schemaVersion === 2 && !provenance) throw new Error('The iOS upload receipt is missing build provenance')
  return result
}
