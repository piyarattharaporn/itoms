import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  outputDir: './test-results/playwright',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_FIREBASE_API_KEY: 'replace-with-e2e-placeholder',
      VITE_FIREBASE_AUTH_DOMAIN: 'replace-with-e2e-placeholder.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'replace-with-e2e-placeholder',
      VITE_FIREBASE_APP_ID: 'replace-with-e2e-placeholder',
      VITE_USE_FIREBASE_EMULATORS: 'false',
      VITE_ENABLE_APP_CHECK: 'false',
      VITE_ENABLE_TRUSTED_BACKEND: 'false',
    },
  },
})
