import { createHash } from 'node:crypto'

type Resource = { id: string, attributes: Record<string, any> }
type Reply = { data: Resource | Resource[], links?: { next?: string } }
export type AppleProvisioningRequest = (path: string, body?: unknown) => Promise<Reply>

/** Refresh profiles for an existing distribution identity; never create or revoke certificates. */
export async function lsuAppStoreProfiles(request: AppleProvisioningRequest, input: { bundle: string, certificateSha1: string }): Promise<Record<string, { content: string, uuid: string }>> {
  if (!/^[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)+$/.test(input.bundle) || !/^[A-F0-9]{40}$/.test(input.certificateSha1))
    throw new Error('Invalid LSU provisioning identity')
  async function list(path: string): Promise<Resource[]> {
    const rows: Resource[] = []
    const seen = new Set<string>()
    while (path) {
      if (seen.has(path)) throw new Error('Apple repeated a provisioning page')
      seen.add(path)
      const page = await request(path)
      if (!Array.isArray(page.data)) throw new Error('Apple returned no provisioning collection')
      rows.push(...page.data)
      if (!page.links?.next) break
      const next = new URL(page.links.next, 'https://api.appstoreconnect.apple.com')
      if (next.origin !== 'https://api.appstoreconnect.apple.com' || !next.pathname.startsWith('/v1/') || next.username || next.password)
        throw new Error('Unsafe Apple provisioning pagination')
      path = next.pathname + next.search
    }
    return rows
  }
  // https://developer.apple.com/documentation/appstoreconnectapi/get-v1-certificates
  const certificates = await list('/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=200')
  const matching = certificates.filter(certificate => ['DISTRIBUTION', 'IOS_DISTRIBUTION'].includes(certificate.attributes.certificateType)
    && Date.parse(certificate.attributes.expirationDate) > Date.now()
    && typeof certificate.attributes.certificateContent === 'string'
    && createHash('sha1').update(Buffer.from(certificate.attributes.certificateContent, 'base64')).digest('hex').toUpperCase() === input.certificateSha1)
  if (matching.length !== 1) throw new Error('Apple must expose exactly the distribution certificate already imported into CI')
  const certificate = matching[0]!
  const result: Record<string, { content: string, uuid: string }> = {}
  for (const identifier of [input.bundle, `${input.bundle}.liveactivity`]) {
    const bundles = (await list(`/v1/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&limit=200`))
      .filter(row => row.attributes.identifier === identifier && ['IOS', 'UNIVERSAL'].includes(row.attributes.platform))
    if (bundles.length !== 1) throw new Error(`Expected one existing Apple bundle ID for ${identifier}`)
    const bundle = bundles[0]!
    let capabilities = await list(`/v1/bundleIds/${encodeURIComponent(bundle.id)}/bundleIdCapabilities?limit=200`)
    if (identifier === input.bundle && !capabilities.some(row => row.attributes.capabilityType === 'ASSOCIATED_DOMAINS')) {
      // Enable only the already requested passkey/universal-link capability on this app.
      // https://developer.apple.com/documentation/appstoreconnectapi/post-v1-bundleidcapabilities
      await request('/v1/bundleIdCapabilities', { data: { type: 'bundleIdCapabilities', attributes: { capabilityType: 'ASSOCIATED_DOMAINS' }, relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } } } } })
      capabilities = await list(`/v1/bundleIds/${encodeURIComponent(bundle.id)}/bundleIdCapabilities?limit=200`)
      if (!capabilities.some(row => row.attributes.capabilityType === 'ASSOCIATED_DOMAINS')) throw new Error('Apple did not enable this app’s Associated Domains capability')
    }
    const state = capabilities.map(row => row.attributes).sort((a, b) => String(a.capabilityType).localeCompare(String(b.capabilityType)))
    const digest = createHash('sha256').update(JSON.stringify([certificate.id, bundle.id, state])).digest('hex').slice(0, 16)
    const name = `LSU ${identifier} App Store ${digest}`
    const profiles = (await list(`/v1/profiles?filter[name]=${encodeURIComponent(name)}&limit=200`))
      .filter(row => row.attributes.name === name && row.attributes.profileType === 'IOS_APP_STORE' && row.attributes.profileState === 'ACTIVE' && Date.parse(row.attributes.expirationDate) > Date.now())
    if (profiles.length > 1) throw new Error('Ambiguous LSU App Store provisioning profiles')
    // A deterministic capability/certificate name reuses a prior successful refresh on retries.
    // https://developer.apple.com/documentation/appstoreconnectapi/post-v1-profiles
    const profile = profiles[0] ?? (await request('/v1/profiles', { data: { type: 'profiles', attributes: { name, profileType: 'IOS_APP_STORE' }, relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } }, certificates: { data: [{ type: 'certificates', id: certificate.id }] } } } })).data as Resource
    if (Array.isArray(profile) || profile.attributes.profileType !== 'IOS_APP_STORE' || profile.attributes.profileState !== 'ACTIVE'
      || typeof profile.attributes.profileContent !== 'string' || typeof profile.attributes.uuid !== 'string')
      throw new Error('Apple did not return an active App Store profile')
    result[identifier] = { content: profile.attributes.profileContent, uuid: profile.attributes.uuid }
  }
  return result
}
