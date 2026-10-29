import type { MobileConfig } from '@stacksjs/types'
import product from '../native/product.json'

/** Website metadata only. native:ios/native:android build HQ's complete config from the source pin. */
export default {
  ios: {
    appName: product.identity.name,
    bundleId: product.bundleId,
    teamId: product.teamId,
    version: product.version,
    buildNumber: String(product.build),
    deploymentTarget: '16.0',
    renderer: 'native',
    url: `${product.site}/m`,
    urlSchemes: [product.identity.scheme],
    appIcon: 'native/assets/icon.png',
    backgroundColor: product.identity.theme.background,
    appearance: 'dark',
    orientations: ['portrait'],
  },
  android: {
    appName: product.identity.name,
    packageName: product.bundleId,
    version: product.version,
    versionCode: product.build,
    renderer: 'native',
    url: `${product.site}/m`,
    urlSchemes: [product.identity.scheme],
    appIcon: 'native/assets/icon.png',
    backgroundColor: product.identity.theme.background,
    appearance: 'dark',
  },
} satisfies MobileConfig
