// Apple release: https://developer.apple.com/news/releases/?id=10152026a
export const releaseXcodeVersion = '27.1'
export const releaseXcodeBuild = '27A9275'

export function assertReleaseXcode(output: string): void {
  const version = /^Xcode (\S+)/m.exec(output)?.[1]
  const build = /^Build version (\S+)/m.exec(output)?.[1]
  if (version !== releaseXcodeVersion || build !== releaseXcodeBuild)
    throw new Error(`TestFlight requires Xcode ${releaseXcodeVersion} (${releaseXcodeBuild}); selected ${version || 'unknown'} (${build || 'unknown'}). Use the TestFlight workflow or set DEVELOPER_DIR to the released toolchain.`)
}

export function assertSigningProfile(profile: { uuid: string, team: string, application: string }, bundle: string, team: string): void {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(profile.uuid)
    || profile.team !== team || profile.application !== `${team}.${bundle}`)
    throw new Error('The provisioning profile does not belong to this LSU application and signing team')
}

/** Profile permissions authorize the app's claims; they are not its signed entitlements. */
export function assertProfileAssociatedDomains(permission: unknown, origin: string): void {
  const host = new URL(origin).hostname
  // Apple profiles may grant a scalar wildcard (TN3125). The exported app
  // must still claim its explicit own domains, checked separately below.
  const grants = permission === '*' ? ['*'] : Array.isArray(permission) ? permission : []
  if (!grants.length || grants.some(grant => typeof grant !== 'string')
    || ![`webcredentials:${host}`, `applinks:${host}`].every(domain => grants.includes('*') || grants.includes(domain)))
    throw new Error('App Store profile does not authorize this installation’s associated domains')
}

/** An intermediate archive signature must never be delivered as the exported IPA. */
export function assertAppStoreSignature(details: string, team: string): void {
  if (/^Signature=adhoc$/m.test(details)
    || !/^Authority=(?:Apple Distribution|iPhone Distribution): .+$/m.test(details)
    || !/^Authority=Apple Root CA(?: - G\d+)?$/m.test(details)
    || /^TeamIdentifier=(.+)$/m.exec(details)?.[1] !== team)
    throw new Error('Exported IPA must have an Apple distribution certificate for the configured team')
}

/** Audit the exported app, including the installation's own passkey relying-party domain. */
export function assertAppStoreEntitlements(entitlements: Record<string, unknown>, bundle: string, team: string, origin: string): void {
  if (entitlements['application-identifier'] !== `${team}.${bundle}` || entitlements['beta-reports-active'] !== true || entitlements['get-task-allow'] === true)
    throw new Error('IPA has no matching App Store distribution identity')
  const host = new URL(origin).hostname
  const domains = entitlements['com.apple.developer.associated-domains']
  if (!Array.isArray(domains) || !domains.includes(`webcredentials:${host}`)
    || domains.some(domain => domain !== `webcredentials:${host}` && domain !== `applinks:${host}`))
    throw new Error('IPA must retain only this installation’s associated domains, including webcredentials')
}
