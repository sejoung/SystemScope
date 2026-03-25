import { test, expect } from '../fixtures/electronApp'

test.describe('앱 기동', () => {
  test('메인 윈도우가 생성된다', async ({ electronApp, mainWindow }) => {
    const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows().length
    })

    expect(windowCount).toBeGreaterThanOrEqual(1)
    expect(await mainWindow.title()).toBeTruthy()
  })
})
