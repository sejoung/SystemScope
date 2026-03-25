import { test as base, _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

type ElectronFixtures = {
  electronApp: ElectronApplication
  mainWindow: Page
}

export const test = base.extend<ElectronFixtures>({
  electronApp: [
    async ({}, use) => {
      const app = await _electron.launch({
        args: [path.join(__dirname, '../../../out/main/index.js')],
        env: { ...process.env, NODE_ENV: 'test', E2E_LIGHTWEIGHT: '1' }
      })
      await use(app)
      await app.close()
    },
    { scope: 'worker', timeout: 30_000 }
  ],

  mainWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow({ timeout: 20_000 })
    await window.waitForLoadState('domcontentloaded')
    await window.bringToFront()
    await window.waitForFunction(() => {
      const scopedWindow = window as Window & {
        systemScope?: unknown
        __E2E_LIGHTWEIGHT?: boolean
      }
      return Boolean(scopedWindow.systemScope) && scopedWindow.__E2E_LIGHTWEIGHT === true
    }, { timeout: 10_000 })
    await window.waitForSelector('[data-testid="nav-dashboard"]', { timeout: 10_000 })
    await use(window)
  }
})

export { expect } from '@playwright/test'
