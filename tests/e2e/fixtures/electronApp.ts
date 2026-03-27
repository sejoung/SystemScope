import { test as base, _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'

type ElectronFixtures = {
  mainWindow: Page
}

type ElectronWorkerFixtures = {
  electronApp: ElectronApplication
}

function trimLogChunks(chunks: string[], maxChars = 8_000): string {
  const joined = chunks.join('')
  return joined.length <= maxChars ? joined : joined.slice(-maxChars)
}

export const test = base.extend<ElectronFixtures, ElectronWorkerFixtures>({
  electronApp: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const stdoutChunks: string[] = []
      const stderrChunks: string[] = []

      const app = await _electron.launch({
        args: [path.join(__dirname, '../../../out/main/index.js')],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          E2E_LIGHTWEIGHT: '1',
          ELECTRON_ENABLE_LOGGING: '1'
        }
      }).catch((error) => {
        const details = [
          'Electron process failed to launch.',
          `entry=${path.join(__dirname, '../../../out/main/index.js')}`,
          stderrChunks.length > 0 ? `stderr:\n${trimLogChunks(stderrChunks)}` : 'stderr: <empty>',
          stdoutChunks.length > 0 ? `stdout:\n${trimLogChunks(stdoutChunks)}` : 'stdout: <empty>'
        ].join('\n\n')

        throw new Error(details, { cause: error })
      })

      const childProcess = app.process()
      childProcess.stdout?.on('data', (chunk: Buffer | string) => {
        stdoutChunks.push(chunk.toString())
      })
      childProcess.stderr?.on('data', (chunk: Buffer | string) => {
        stderrChunks.push(chunk.toString())
      })

      await use(app)
      await app.close()
    },
    { scope: 'worker', timeout: 30_000 }
  ],

  mainWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow({ timeout: 20_000 })
    await window.waitForLoadState('domcontentloaded')
    await window.bringToFront()
    await window.waitForFunction(() => {
      const w = globalThis as unknown as {
        systemScope?: unknown
        __E2E_LIGHTWEIGHT?: boolean
      }
      return Boolean(w.systemScope) && w.__E2E_LIGHTWEIGHT === true
    }, { timeout: 10_000 })
    await window.waitForSelector('[data-testid="nav-dashboard"]', { timeout: 10_000 })
    await use(window)
  }
})

export { expect } from '@playwright/test'
