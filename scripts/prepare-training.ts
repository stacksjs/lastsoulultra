import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import deployment from '../enterprise/deployment.json'
import product from '../native/product.json'
import { prepareNativeSource, root, sourceRoot } from './native-source'

/** Tenant-owned inputs only. Application behavior remains the pinned HQ source. */
export async function prepareTrainingSource(): Promise<void> {
  if (product.site !== deployment.origin || product.identity.apiOrigin !== deployment.origin || product.deployment.id !== deployment.id
    || product.deployment.country !== deployment.residency.country || product.deployment.location !== deployment.residency.location)
    throw new Error('Native and server deployment identities must agree')
  await prepareNativeSource()
  const directory = join(sourceRoot, 'deployment/lsu')
  mkdirSync(join(directory, 'assets'), { recursive: true })
  copyFileSync(join(root, 'scripts/seed-demo-accounts.ts'), join(directory, 'seed-demo-accounts.ts'))
  copyFileSync(join(root, 'scripts/lsu-demo-plan.ts'), join(directory, 'lsu-demo-plan.ts'))
  copyFileSync(join(root, 'enterprise/seed-review.ts'), join(directory, 'seed-review.ts'))
  copyFileSync(join(root, 'native/assets/icon.png'), join(directory, 'assets/icon.png'))
  copyFileSync(join(root, 'public/assets/lsu/images/lsu-logo.svg'), join(directory, 'assets/logo.svg'))
  writeFileSync(join(directory, 'product.json'), JSON.stringify({ ...product, output: '../../storage/framework/mobile', assets: { icon: 'assets/icon.png', splash: 'assets/logo.svg' } }))
  writeFileSync(join(sourceRoot, 'resources/functions/enterprise-deployment.json'), JSON.stringify({ deployment }))
}
