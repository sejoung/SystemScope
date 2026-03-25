import { test, expect } from '../fixtures/electronApp'

test.describe('앱 기동', () => {
  test('메인 윈도우가 생성된다', async ({ electronApp, mainWindow }) => {
    const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows().length
    })

    expect(windowCount).toBeGreaterThanOrEqual(1)
    expect(await mainWindow.title()).toBeTruthy()
  })

  test('윈도우 최소 크기가 설정되어 있다', async ({ mainWindow }) => {
    const { width, height } = await mainWindow.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }))

    expect(width).toBeGreaterThanOrEqual(1000)
    expect(height).toBeGreaterThanOrEqual(600)
  })

  test('preload API가 노출되어 있다', async ({ mainWindow }) => {
    const apiKeys = await mainWindow.evaluate(() => {
      return Object.keys((window as Record<string, unknown>).systemScope as object)
    })

    expect(apiKeys).toContain('getSystemStats')
    expect(apiKeys).toContain('subscribeSystem')
    expect(apiKeys).toContain('getSettings')
  })
})
