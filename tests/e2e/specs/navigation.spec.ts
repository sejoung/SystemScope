import { test, expect } from '../fixtures/electronApp'

test.describe('사이드바 네비게이션', () => {
  test('기본 페이지는 Overview이다', async ({ mainWindow }) => {
    // 시스템 데이터 수신 전에는 PageLoading, 수신 후에는 dashboard-grid-3 표시
    await expect(mainWindow.locator('.dashboard-grid-3, [data-testid="page-loading"]')).toBeVisible({ timeout: 15_000 })
  })

  test('Storage 페이지로 이동', async ({ mainWindow }) => {
    await mainWindow.locator('nav >> button', { hasText: 'Storage' }).click()
    await expect(mainWindow.locator('button', { hasText: 'Scan' }).first()).toBeVisible()
    await expect(mainWindow.locator('button', { hasText: 'Cleanup' }).first()).toBeVisible()
  })

  test('Docker 페이지로 이동', async ({ mainWindow }) => {
    await mainWindow.locator('nav >> button', { hasText: 'Docker' }).click()
    await expect(mainWindow.locator('h2', { hasText: 'Docker' })).toBeVisible()
  })

  test('Activity 페이지로 이동', async ({ mainWindow }) => {
    await mainWindow.locator('nav >> button', { hasText: 'Activity' }).click()
    await expect(mainWindow.locator('h2', { hasText: 'Activity' })).toBeVisible()
  })

  test('Applications 페이지로 이동', async ({ mainWindow }) => {
    await mainWindow.locator('nav >> button', { hasText: 'Applications' }).click()
    await expect(mainWindow.locator('button', { hasText: 'Installed' }).first()).toBeVisible()
  })

  test('Preferences 페이지로 이동', async ({ mainWindow }) => {
    await mainWindow.locator('nav >> button', { hasText: 'Preferences' }).click()
    await expect(mainWindow.locator('text=Appearance')).toBeVisible()
  })

  test('Overview로 복귀', async ({ mainWindow }) => {
    await mainWindow.locator('nav >> button', { hasText: 'Preferences' }).click()
    await expect(mainWindow.locator('text=Appearance')).toBeVisible()
    await mainWindow.locator('nav >> button', { hasText: 'Overview' }).click()
    await expect(mainWindow.locator('.dashboard-grid-3, [data-testid="page-loading"]')).toBeVisible({ timeout: 15_000 })
  })
})
