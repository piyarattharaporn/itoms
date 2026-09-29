import { defineConfig } from '@playwright/test'

const managedServers = process.env.ITOMS_SAMPLING_SERVERS !== 'external'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /sampling\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  outputDir: './test-results/playwright-sampling',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: managedServers
    ? [
        {
          command:
            'firebase emulators:start --config firebase.e2e-test.json --project demo-lotus-it-portal-local --only auth,firestore',
          url: 'http://127.0.0.1:18080',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command:
            'node scripts/wait-for-emulator.mjs 127.0.0.1 19099 && node scripts/seed-local-emulator.mjs && node scripts/seed-local-sampling.mjs && npm run dev -- --host 127.0.0.1 --port 4175',
          url: 'http://127.0.0.1:4175',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            VITE_FIREBASE_API_KEY: 'demo-api-key',
            VITE_FIREBASE_AUTH_DOMAIN: 'localhost',
            VITE_FIREBASE_PROJECT_ID: 'demo-lotus-it-portal-local',
            VITE_FIREBASE_APP_ID: 'demo-app-id',
            VITE_USE_FIREBASE_EMULATORS: 'true',
            VITE_AUTH_EMULATOR_PORT: '19099',
            VITE_FIRESTORE_EMULATOR_PORT: '18080',
            VITE_ENABLE_APP_CHECK: 'false',
            VITE_ENABLE_TRUSTED_BACKEND: 'false',
          },
        },
      ]
    : undefined,
})
