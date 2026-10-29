import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron } from '@playwright/test'

if (process.platform !== 'darwin') throw new Error('This check requires macOS')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'test-results/macos-runtime')
const temp = await mkdtemp(path.join(tmpdir(), 'systemscope-runtime-'))
const userData = path.join(temp, 'user-data')
await mkdir(userData)
await mkdir(output, { recursive: true })
const bootstrap = path.join(temp, 'bootstrap.cjs')
await writeFile(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(userData)}); require(${JSON.stringify(path.join(root, 'out/main/index.js'))});`)

let app
try {
  app = await _electron.launch({
    args: [bootstrap],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Disable background scans, but keep the production preload and real IPC.
      E2E_LIGHTWEIGHT: '1',
      PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
    },
  })
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.waitForFunction(() => Boolean(window.systemScope))
  assert.equal(await page.evaluate(() => window.__E2E_LIGHTWEIGHT), false,
    'Build in production mode before running this check')
  const result = await page.evaluate(async () => {
    const api = window.systemScope
    const [first, networkFirst, ports, processes, startup, apps] = await Promise.all([
      api.getSystemStats(), api.getNetworkUsage(), api.getNetworkPorts(),
      api.getProcessSnapshot(5), api.getStartupItems(), api.listInstalledApps(),
    ])
    await new Promise((resolve) => setTimeout(resolve, 2200))
    const [second, networkSecond] = await Promise.all([api.getSystemStats(), api.getNetworkUsage()])
    return { first, networkFirst, ports, processes, startup, apps, second, networkSecond }
  })
  for (const [key, value] of Object.entries(result)) {
    assert.equal(value.ok, true, `${key}: ${JSON.stringify(value.error)}`)
  }
  const stats = result.second.data
  if (stats.network.interfaces.length > 0 && result.first.data.network.interfaces.length > 0) {
    assert.ok(Number.isFinite(stats.network.downloadBytesPerSecond), 'Network rate unavailable after baseline')
  }
  assert.ok(result.processes.data.allProcesses.length > 0)
  const systemDrive = stats.disk.drives.find((drive) => drive.mount === '/')
  if (systemDrive?.realUsage !== null && systemDrive?.realUsage !== undefined) {
    assert.equal(systemDrive.purgeable, null)
    assert.equal(systemDrive.used, systemDrive.size - systemDrive.available)
  }
  await page.getByTestId('nav-process').click()
  await page.locator('#activity-network').click()
  await page.getByRole('table').waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(output, 'network.png'), fullPage: true })
  await page.locator('#activity-ports').click()
  if (result.ports.data.some((port) => port.state === 'LISTEN')) {
    await page.getByText('LISTEN', { exact: true }).first().waitFor({ state: 'visible' })
  }
  await page.screenshot({ path: path.join(output, 'ports.png'), fullPage: true })
  assert.deepEqual(errors, [])
  const summary = {
    network: stats.network,
    networkProcesses: result.networkSecond.data.processes.length,
    measurableProcesses: result.networkSecond.data.processes.filter((row) => row.rxBps !== null).length,
    ports: result.ports.data.length,
    listeningPorts: result.ports.data.filter((row) => row.state === 'LISTEN').length,
    processes: result.processes.data.allProcesses.length,
    startupItems: result.startup.data.length,
    installedApps: result.apps.data.length,
    gpu: stats.gpu,
    systemDrive,
    rendererErrors: errors,
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
} finally {
  if (app) await app.close()
  await rm(temp, { recursive: true, force: true })
}
