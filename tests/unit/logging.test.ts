import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  userDataPath: ''
}))

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name !== 'userData') throw new Error(`Unexpected app path request: ${name}`)
      return state.userDataPath
    }
  }
}))

vi.mock('electron-log', () => ({
  default: {
    transports: {
      file: {
        level: 'silly',
        resolvePathFn: () => ''
      },
      console: {
        level: 'silly'
      }
    },
    warn: vi.fn()
  }
}))

const logging = await import('../../src/main/services/logging')
const {
  cleanupOldLogs,
  formatDateForLogFile,
  getAccessLogFilePath,
  getAccessLogDir,
  getLogDir,
  getSystemLogDir,
  initializeLogging,
  logInfoAction
} = logging

describe('logging service', () => {
  let tempRoot = ''

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-logs-'))
    state.userDataPath = tempRoot
  })

  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('should format log file names by local date', () => {
    expect(formatDateForLogFile(new Date(2026, 2, 22, 14, 30))).toBe('2026-03-22')
  })

  it('should remove only log files older than the retention window', async () => {
    const systemLogDir = getSystemLogDir()
    const accessLogDir = getAccessLogDir()
    await fs.mkdir(systemLogDir, { recursive: true })
    await fs.mkdir(accessLogDir, { recursive: true })
    await fs.writeFile(path.join(systemLogDir, 'systemscope-2026-03-12.log'), '')
    await fs.writeFile(path.join(systemLogDir, 'systemscope-2026-03-13.log'), '')
    await fs.writeFile(path.join(accessLogDir, 'systemscope-access-2026-03-12.log'), '')
    await fs.writeFile(path.join(accessLogDir, 'systemscope-access-2026-03-13.log'), '')
    await fs.writeFile(path.join(systemLogDir, 'systemscope-2026-03-22.log'), '')
    await fs.writeFile(path.join(systemLogDir, 'notes.txt'), '')

    cleanupOldLogs(new Date(2026, 2, 22, 9, 0), 10)

    const systemFiles = await fs.readdir(systemLogDir)
    const accessFiles = await fs.readdir(accessLogDir)
    expect(systemFiles).not.toContain('systemscope-2026-03-12.log')
    expect(accessFiles).not.toContain('systemscope-access-2026-03-12.log')
    expect(systemFiles).toContain('systemscope-2026-03-13.log')
    expect(accessFiles).toContain('systemscope-access-2026-03-13.log')
    expect(systemFiles).toContain('systemscope-2026-03-22.log')
    expect(systemFiles).toContain('notes.txt')
  })

  it('should initialize file logging under the app logs directory', () => {
    initializeLogging()

    expect(getLogDir()).toBe(path.join(tempRoot, 'logs'))
  })

  it('should write action logs to the dedicated access log file', async () => {
    initializeLogging()

    logInfoAction('apps-ipc', 'installed.list', { count: 3, requestId: 'req-1' })

    const contents = await fs.readFile(getAccessLogFilePath(new Date()), 'utf8')
    expect(contents).toContain('action=installed.list result=success')
    expect(contents).toContain('"requestId":"req-1"')
  })
})
