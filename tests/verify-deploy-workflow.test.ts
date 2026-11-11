import { expect, test } from 'bun:test'

test('every production deploy ends by checking the deployed site', async () => {
  const workflow = await Bun.file('.github/workflows/deploy.yml').text()
  const deploy = workflow.indexOf('run: ./buddy deploy')
  const check = workflow.indexOf('run: bun scripts/verify-deploy.ts')

  expect(deploy).toBeGreaterThan(-1)
  // After the deploy, never before it: the check asks the servers it just changed.
  expect(check).toBeGreaterThan(deploy)
  // The gate's credentials and the review accounts are what it signs in with.
  const step = workflow.slice(check)
  for (const secret of ['SITE_AUTH_USER', 'SITE_AUTH_PASSWORD', 'LSU_DEMO_ACCOUNTS_JSON'])
    expect(step).toContain(`secrets.${secret}`)
})
