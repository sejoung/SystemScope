import { test, expect } from '../fixtures/electronApp'

test.describe('설정 페이지 업데이트 확인', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await mainWindow.evaluate(() => {
      window.__E2E_CONTROLS__?.reset()
    })
  })

  test('업데이트 확인 버튼 클릭 후에도 설정 화면이 유지된다', async ({ mainWindow }) => {
    const settingsNav = mainWindow.getByTestId('nav-settings')
    await expect(settingsNav).toBeVisible({ timeout: 5_000 })
    await settingsNav.click({ noWaitAfter: true })

    const settingsPage = mainWindow.getByTestId('page-settings')
    await expect(settingsPage).toBeVisible({ timeout: 5_000 })

    const checkButton = mainWindow.getByRole('button', { name: 'Check for Updates' })
    await expect(checkButton).toBeVisible()
    await checkButton.click({ noWaitAfter: true })

    await expect(settingsPage).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByText('Last checked:', { exact: false })).toBeVisible()
    await expect(mainWindow.getByText('No update check has been run yet.')).not.toBeVisible()
  })

  test('업데이트가 있을 때 다운로드 버튼이 나타나도 설정 화면이 유지된다', async ({ mainWindow }) => {
    await mainWindow.evaluate(() => {
      window.__E2E_CONTROLS__?.setUpdateAvailable(true)
    })

    const settingsNav = mainWindow.getByTestId('nav-settings')
    await expect(settingsNav).toBeVisible({ timeout: 5_000 })
    await settingsNav.click({ noWaitAfter: true })

    const settingsPage = mainWindow.getByTestId('page-settings')
    await expect(settingsPage).toBeVisible({ timeout: 5_000 })

    const checkButton = mainWindow.getByRole('button', { name: 'Check for Updates' })
    await expect(checkButton).toBeVisible()
    await checkButton.click({ noWaitAfter: true })

    await expect(settingsPage).toBeVisible({ timeout: 5_000 })
    await expect(mainWindow.getByRole('button', { name: 'Download' })).toBeVisible()
    await expect(mainWindow.getByText('A new version v1.3.0 is available.')).toBeVisible()
  })
})
