import { defineConfig } from '@playwright/test'

if (process.env.ITOMS_ALLOW_PRODUCTION_E2E !== 'true') {
  throw new Error(
    'Production E2E is disabled by default. Set ITOMS_ALLOW_PRODUCTION_E2E=true only for an explicitly approved read-only test.',
  )
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /firebase-readonly\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  outputDir: './test-results/playwright-firebase',
  use: {
    baseURL: 'https://itoms-v2.web.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
