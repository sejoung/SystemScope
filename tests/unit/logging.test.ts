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
const { cleanupOldLogs, formatDateForLogFile, getLogDir, initializeLogging } = logging

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
    const logDir = getLogDir()
    await fs.mkdir(logDir, { recursive: true })
    await fs.writeFile(path.join(logDir, 'systemscope-2026-03-12.log'), '')
    await fs.writeFile(path.join(logDir, 'systemscope-2026-03-13.log'), '')
    await fs.writeFile(path.join(logDir, 'systemscope-2026-03-22.log'), '')
    await fs.writeFile(path.join(logDir, 'notes.txt'), '')

    cleanupOldLogs(new Date(2026, 2, 22, 9, 0), 10)

    const files = await fs.readdir(logDir)
    expect(files).not.toContain('systemscope-2026-03-12.log')
    expect(files).toContain('systemscope-2026-03-13.log')
    expect(files).toContain('systemscope-2026-03-22.log')
    expect(files).toContain('notes.txt')
  })

  it('should initialize file logging under the app logs directory', () => {
    initializeLogging()

    expect(getLogDir()).toBe(path.join(tempRoot, 'logs'))
  })
})
