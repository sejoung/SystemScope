import { test, expect } from '../fixtures/electronApp'

test.describe('Process anomalies', () => {
  test('shows long-running processes without automatic termination', async ({ mainWindow }) => {
    await mainWindow.getByTestId('nav-process').click({ noWaitAfter: true })
    await expect(mainWindow.getByTestId('page-process')).toBeVisible({ timeout: 5_000 })

    await mainWindow.locator('#activity-anomalies').click()

    await expect(mainWindow.getByRole('heading', { name: 'Process Anomalies' })).toBeVisible()
    await expect(mainWindow.getByText('Automatic termination is disabled.')).toBeVisible()
    await expect(mainWindow.getByText('node', { exact: true })).toBeVisible()
    await expect(mainWindow.getByText('Long-running', { exact: true })).toBeVisible()
    await expect(mainWindow.getByText('2h', { exact: true })).toBeVisible()
    await expect(mainWindow.getByRole('button', { name: 'Review & terminate' })).toBeVisible()

    await mainWindow.getByLabel('Long-running threshold').selectOption(String(24 * 60 * 60 * 1000))
    await expect(mainWindow.getByText('No processes match the current anomaly filters.')).toBeVisible()
  })
})
