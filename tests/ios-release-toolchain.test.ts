import { expect, it } from 'bun:test'
import { assertReleaseXcode, assertSigningProfile } from '../scripts/ios-release-toolchain'

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
