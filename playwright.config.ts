import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e/specs',
  timeout: 15_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    screenshot: 'only-on-failure'
  }
})
