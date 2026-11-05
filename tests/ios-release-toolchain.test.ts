import { expect, it } from 'bun:test'
import { assertAppStoreEntitlements, assertAppStoreSignature, assertReleaseXcode, assertSigningProfile } from '../scripts/ios-release-toolchain'

it('rejects the beta SDK Apple refused before starting another release archive', () => {
  expect(() => assertReleaseXcode('Xcode 27.0\nBuild version 27A5218g\n')).toThrow('released toolchain')
  expect(() => assertReleaseXcode('Xcode 27.1\nBuild version 27A9269\n')).toThrow()
  expect(() => assertReleaseXcode('Xcode 27.1\nBuild version 27A9275\n')).not.toThrow()
})

it('admits only the LSU app and extension profiles for the configured signing team', () => {
  const profile = { uuid: '685478f4-498e-49de-8c36-46726952cb1f', team: '3JJRNQW6B7', application: '3JJRNQW6B7.com.lastsoulultra.app' }
  expect(() => assertSigningProfile(profile, 'com.lastsoulultra.app', '3JJRNQW6B7')).not.toThrow()
  expect(() => assertSigningProfile({ ...profile, application: `${profile.application}.liveactivity` }, 'com.lastsoulultra.app.liveactivity', profile.team)).not.toThrow()
  for (const changed of [{ ...profile, application: '3JJRNQW6B7.training.hq.app' }, { ...profile, team: 'OTHERTEAM1' }, { ...profile, uuid: '../profile' }])
    expect(() => assertSigningProfile(changed, 'com.lastsoulultra.app', profile.team)).toThrow()
})

it('requires distribution signing and the installation’s own passkey domain in the exported app', () => {
  const identity = { 'application-identifier': '3JJRNQW6B7.com.lastsoulultra.app', 'beta-reports-active': true }
  const origin = 'https://training.lsu.stacksjs.com'
  const check = (changes: Record<string, unknown>) => assertAppStoreEntitlements({ ...identity, ...changes }, 'com.lastsoulultra.app', '3JJRNQW6B7', origin)
  expect(() => check({})).toThrow('associated domains')
  expect(() => check({ 'com.apple.developer.associated-domains': ['webcredentials:hq.training'] })).toThrow('associated domains')
  expect(() => check({ 'com.apple.developer.associated-domains': ['webcredentials:training.lsu.stacksjs.com', 'webcredentials:hq.training'] })).toThrow('associated domains')
  const domains = { 'com.apple.developer.associated-domains': ['webcredentials:training.lsu.stacksjs.com'] }
  expect(() => check(domains)).not.toThrow()
  expect(() => check({ ...domains, 'get-task-allow': true })).toThrow('distribution identity')
  expect(() => check({ ...domains, 'application-identifier': 'OTHERTEAM.com.lastsoulultra.app' })).toThrow('distribution identity')
  expect(() => check({ ...domains, 'beta-reports-active': false })).toThrow('distribution identity')
})

it('refuses an ad-hoc or development signature even when the app carries distribution entitlements', () => {
  const signature = 'Authority=Apple Distribution: Example (3JJRNQW6B7)\nAuthority=Apple Worldwide Developer Relations Certification Authority\nAuthority=Apple Root CA\nTeamIdentifier=3JJRNQW6B7\n'
  expect(() => assertAppStoreSignature(signature, '3JJRNQW6B7')).not.toThrow()
  expect(() => assertAppStoreSignature(signature.replace('Apple Root CA', 'Apple Root CA - G3'), '3JJRNQW6B7')).not.toThrow()
  expect(() => assertAppStoreSignature('Signature=adhoc\nTeamIdentifier=3JJRNQW6B7\n', '3JJRNQW6B7')).toThrow('distribution certificate')
  expect(() => assertAppStoreSignature(signature.replace('Apple Distribution:', 'Apple Development:'), '3JJRNQW6B7')).toThrow()
  expect(() => assertAppStoreSignature(signature, 'OTHERTEAM1')).toThrow()
  expect(() => assertAppStoreSignature(signature.replace('Authority=Apple Root CA\n', ''), '3JJRNQW6B7')).toThrow()
})
