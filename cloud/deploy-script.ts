import { prepareTrainingSource } from '../scripts/prepare-training'
/**
 * Custom Deploy Script
 *
 * This script runs during deployment. Use the hooks below to execute
 * custom logic before and after your infrastructure is deployed.
 *
 * Examples:
 * - Run database seeders after deployment
 * - Notify your team via Slack/Discord
 * - Warm up caches
 * - Run smoke tests against the deployed environment
 * - Sync environment variables
 *
 * @see https://stacksjs.org/docs/deployments
 */

/**
 * Runs before the infrastructure stack is deployed.
 * Use this for pre-deployment checks, building assets, or notifications.
 */
export async function beforeDeploy({ environment, region }: { environment: string, region: string }): Promise<void> {
  if (!process.env.SITE_AUTH_USER || !process.env.SITE_AUTH_PASSWORD)
    throw new Error('The LSU private preview requires SITE_AUTH_USER and SITE_AUTH_PASSWORD for both the site and documentation.')
  console.log(`  Preparing deployment to ${environment} in ${region}...`)
  if (environment !== 'production') throw new Error('Declare a separate enterprise database and residency contract before deploying another environment')
  if (!process.env.LSU_TRAINING_APP_KEY || !process.env.LSU_TRAINING_DB_PASSWORD || !process.env.LSU_DEMO_ACCOUNTS_JSON)
    throw new Error('The enterprise backend needs its own encryption key, database password and synthetic review accounts')
  await prepareTrainingSource()
}

/**
 * Runs after the infrastructure stack has been successfully deployed.
 * Use this for post-deployment tasks like cache warming, notifications, or smoke tests.
 */
export async function afterDeploy({ environment, outputs }: { environment: string, region: string, outputs: Record<string, string> }): Promise<void> {
  console.log(`  Deployment to ${environment} complete`)

  // Example: Log useful outputs
  for (const [key, value] of Object.entries(outputs)) {
    if (key.endsWith('PublicIp') || key.endsWith('DNS') || key.endsWith('Endpoint')) {
      console.log(`  ${key}: ${value}`)
    }
  }
}
