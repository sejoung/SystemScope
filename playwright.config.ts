import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e/specs',
  testMatch: '*.spec.ts',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    screenshot: 'only-on-failure'
  }
})
