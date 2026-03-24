import { test, expect } from '../fixtures/electronApp'

test.describe('사이드바 네비게이션', () => {
  test('모든 페이지 탐색', async ({ mainWindow }) => {
    // Overview (기본 페이지)
    await expect(mainWindow.locator('.dashboard-grid-3, [data-testid="page-loading"]')).toBeVisible({ timeout: 15_000 })

    // Storage
    await mainWindow.locator('nav >> button', { hasText: 'Storage' }).click()
    await expect(mainWindow.locator('button', { hasText: 'Scan' }).first()).toBeVisible()

    // Docker
    await mainWindow.locator('nav >> button', { hasText: 'Docker' }).click()
    await expect(mainWindow.locator('h2', { hasText: 'Docker' })).toBeVisible()

    // Activity
    await mainWindow.locator('nav >> button', { hasText: 'Activity' }).click()
    await expect(mainWindow.locator('h2:has-text("Activity"), [data-testid="page-loading"]')).toBeVisible({ timeout: 15_000 })

    // Applications
    await mainWindow.locator('nav >> button', { hasText: 'Applications' }).click()
    await expect(mainWindow.locator('button', { hasText: 'Installed' }).first()).toBeVisible()

    // Preferences
    await mainWindow.locator('nav >> button', { hasText: 'Preferences' }).click()
    await expect(mainWindow.locator('text=Appearance')).toBeVisible()

    // Overview 복귀
    await mainWindow.locator('nav >> button', { hasText: 'Overview' }).click()
    await expect(mainWindow.locator('.dashboard-grid-3, [data-testid="page-loading"]')).toBeVisible({ timeout: 15_000 })
  })
})
