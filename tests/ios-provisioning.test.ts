import { expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { lsuAppStoreProfiles } from '../scripts/ios-provisioning'
import type { AppleProvisioningRequest } from '../scripts/ios-provisioning'

const bundle = 'com.lastsoulultra.app'
const content = Buffer.from('the existing imported distribution certificate').toString('base64')
const sha1 = createHash('sha1').update(Buffer.from(content, 'base64')).digest('hex').toUpperCase()

function apple() {
  const mutations: Array<{ path: string, body: any }> = []
  const profiles = new Map<string, any>()
  let associated = false
  let foreignCertificate = false
  const request: AppleProvisioningRequest = async (path, body: any) => {
    const url = new URL(path, 'https://api.appstoreconnect.apple.com')
    if (body) mutations.push({ path, body })
    if (url.pathname === '/v1/certificates') return { data: [{ id: 'existing-cert', attributes: { certificateType: 'DISTRIBUTION', expirationDate: '2099-01-01', certificateContent: foreignCertificate ? Buffer.from('another certificate').toString('base64') : content } }] }
    if (url.pathname === '/v1/bundleIds') {
      const identifier = url.searchParams.get('filter[identifier]')!
      return { data: [{ id: identifier === bundle ? 'app' : 'activity', attributes: { identifier, platform: 'IOS' } }] }
    }
    if (!body && url.pathname.endsWith('/bundleIdCapabilities')) return { data: [{ id: 'push', attributes: { capabilityType: 'PUSH_NOTIFICATIONS' } }, ...(url.pathname.includes('/app/') && associated ? [{ id: 'domains', attributes: { capabilityType: 'ASSOCIATED_DOMAINS' } }] : [])] }
    if (url.pathname === '/v1/bundleIdCapabilities') {
      expect(body.data.relationships.bundleId.data.id).toBe('app')
      associated = true
      return { data: { id: 'domains', attributes: body.data.attributes } }
    }
    if (url.pathname === '/v1/profiles' && !body) {
      const found = profiles.get(url.searchParams.get('filter[name]')!)
      return { data: found ? [found] : [] }
    }
    if (url.pathname === '/v1/profiles' && body) {
      const profile = { id: `profile-${profiles.size}`, attributes: { ...body.data.attributes, profileState: 'ACTIVE', expirationDate: '2099-01-01', uuid: '685478f4-498e-49de-8c36-46726952cb1f', profileContent: 'profile-cms-content' } }
      profiles.set(profile.attributes.name, profile)
      return { data: profile }
    }
    throw new Error(`Unexpected Apple operation ${path}`)
  }
  return { request, mutations, foreign: () => { foreignCertificate = true } }
}

it('refreshes only the existing app and activity profiles with the imported certificate, preserving other capabilities', async () => {
  const api = apple()
  const result = await lsuAppStoreProfiles(api.request, { bundle, certificateSha1: sha1 })
  expect(Object.keys(result)).toEqual([bundle, `${bundle}.liveactivity`])
  expect(api.mutations.map(mutation => mutation.path)).toEqual(['/v1/bundleIdCapabilities', '/v1/profiles', '/v1/profiles'])
  expect(api.mutations[0]!.body.data.attributes).toEqual({ capabilityType: 'ASSOCIATED_DOMAINS' })
  for (const mutation of api.mutations.slice(1)) {
    expect(mutation.body.data.attributes.profileType).toBe('IOS_APP_STORE')
    expect(mutation.body.data.relationships.certificates.data).toEqual([{ type: 'certificates', id: 'existing-cert' }])
  }
  await lsuAppStoreProfiles(api.request, { bundle, certificateSha1: sha1 })
  expect(api.mutations).toHaveLength(3)
})

it('refuses another certificate before changing any capability or profile', async () => {
  const api = apple()
  api.foreign()
  await expect(lsuAppStoreProfiles(api.request, { bundle, certificateSha1: sha1 })).rejects.toThrow('already imported')
  expect(api.mutations).toEqual([])
})

it('refuses foreign pagination and missing existing bundle IDs without creating app IDs or certificates', async () => {
  const api = apple()
  await expect(lsuAppStoreProfiles(async () => ({ data: [], links: { next: 'https://elsewhere.test/v1/certificates' } }), { bundle, certificateSha1: sha1 })).rejects.toThrow('Unsafe')
  await expect(lsuAppStoreProfiles(async (path, body) => path.startsWith('/v1/bundleIds?') ? { data: [] } : api.request(path, body), { bundle, certificateSha1: sha1 })).rejects.toThrow('existing Apple bundle')
  expect(api.mutations).toEqual([])
})
