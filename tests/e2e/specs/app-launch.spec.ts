import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

test.describe('앱 기동', () => {
  let electronApp: ElectronApplication
  let mainWindow: Page

  test.beforeAll(async () => {
    electronApp = await _electron.launch({
      args: [path.join(__dirname, '../../../out/main/index.js')],
      env: { ...process.env, NODE_ENV: 'test', E2E_LIGHTWEIGHT: '1' }
    })

    mainWindow = await electronApp.firstWindow({ timeout: 45_000 })
    await mainWindow.waitForLoadState('domcontentloaded')
    await mainWindow.bringToFront()
    await mainWindow.waitForFunction(() => {
      const scopedWindow = window as Window & { systemScope?: unknown }
      return Boolean(scopedWindow.systemScope)
    })
    await mainWindow.waitForSelector('body[data-e2e-ready="1"]', {
      timeout: 15_000
    })
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('메인 윈도우가 생성된다', async () => {
    const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows().length
    })
    expect(windowCount).toBeGreaterThanOrEqual(1)
    expect(await mainWindow.title()).toBeTruthy()
  })

  test('윈도우 최소 크기가 설정되어 있다', async () => {
    const { width, height } = await mainWindow.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }))
    expect(width).toBeGreaterThanOrEqual(1000)
    expect(height).toBeGreaterThanOrEqual(600)
  })

  test('preload API가 노출되어 있다', async () => {
    const apiKeys = await mainWindow.evaluate(() => {
      return Object.keys((window as Record<string, unknown>).systemScope as object)
    })
    expect(apiKeys).toContain('getSystemStats')
    expect(apiKeys).toContain('subscribeSystem')
    expect(apiKeys).toContain('getSettings')
  })
})
