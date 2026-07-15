import { test, expect } from '../fixtures/electronApp'

test.describe('Timeline 상호작용', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await mainWindow.getByTestId('nav-timeline').click({ noWaitAfter: true })
    await expect(mainWindow.getByTestId('page-timeline')).toBeVisible({ timeout: 5_000 })
  })

  test('기간을 변경하고 경량 차트에서 상세 지점을 선택한다', async ({ mainWindow }) => {
    const sevenDays = mainWindow.getByRole('tab', { name: '7 Days' })
    await sevenDays.click()
    await expect(sevenDays).toHaveAttribute('aria-selected', 'true')

    const chart = mainWindow.getByRole('img', { name: 'CPU, memory, and disk usage timeline' })
    await expect(chart).toBeVisible()
    await chart.click({ position: { x: 220, y: 100 } })

    await expect(mainWindow.getByRole('heading', { name: 'Point Detail' })).toBeVisible()
    await expect(mainWindow.getByText('node', { exact: true })).toBeVisible()
    await mainWindow.getByRole('button', { name: 'Close' }).click()
    await expect(mainWindow.getByRole('heading', { name: 'Point Detail' })).toHaveCount(0)
  })

  test('이벤트 필터 전환 후 빈 상태를 유지한다', async ({ mainWindow }) => {
    const alerts = mainWindow.getByRole('tab', { name: 'Alerts' })
    await alerts.click()
    await expect(alerts).toHaveAttribute('aria-selected', 'true')
    await expect(mainWindow.getByText('No events recorded yet.')).toBeVisible()
  })
})
