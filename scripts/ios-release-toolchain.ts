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
