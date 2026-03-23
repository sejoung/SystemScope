import { test as base, _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

type ElectronFixtures = {
  electronApp: ElectronApplication
  mainWindow: Page
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const app = await _electron.launch({
      args: [path.join(__dirname, '../../../out/main/index.js')],
      env: { ...process.env, NODE_ENV: 'test' }
    })
    await use(app)
    await app.close()
  },

  mainWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow({ timeout: 10_000 })
    await window.waitForLoadState('domcontentloaded')
    await use(window)
  }
})

export { expect } from '@playwright/test'
