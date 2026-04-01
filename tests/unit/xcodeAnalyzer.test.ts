import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Dirent, Stats } from 'node:fs'

const runExternalCommand = vi.hoisted(() => vi.fn())

vi.mock('../../src/main/services/externalCommand', () => ({
  runExternalCommand,
  isExternalCommandError: (error: unknown) => {
    return Boolean(error) && typeof error === 'object' && 'kind' in (error as Record<string, unknown>)
  }
}))

vi.mock('../../src/main/utils/getDirSize', () => ({
  getDirSizeEstimate: vi.fn().mockResolvedValue(1024 * 1024 * 100)
}))

vi.mock('../../src/main/services/logging', () => ({
  logInfo: vi.fn(), logDebug: vi.fn(), logError: vi.fn()
}))

function makeDirent(name: string, isDir: boolean): Dirent {
  return { name, isDirectory: () => isDir, isFile: () => !isDir, isSymbolicLink: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, path: '', parentPath: '' } as Dirent
}

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    stat: vi.fn().mockResolvedValue({ isDirectory: () => true, isFile: () => false, size: 1024 * 1024 * 50, mtimeMs: Date.now() - 100 * 24 * 60 * 60 * 1000 } as unknown as Stats),
    readdir: vi.fn().mockResolvedValue([]),
    access: vi.fn().mockResolvedValue(undefined)
  }
})

describe('xcodeAnalyzer', () => {
  beforeEach(() => {
    vi.resetModules()
    runExternalCommand.mockReset()
  })

  it('should return not_installed when DerivedData and Archives do not exist', async () => {
    const { stat } = await import('node:fs/promises')
    vi.mocked(stat).mockRejectedValue(new Error('ENOENT'))

    const { scanXcode } = await import('../../src/main/services/xcodeAnalyzer')
    const result = await scanXcode()

    expect(result.tool).toBe('xcode')
    expect(result.status).toBe('not_installed')
  })

  it('should scan DerivedData directories and create reclaimable items', async () => {
    const { stat, readdir } = await import('node:fs/promises')
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true, isFile: () => false, size: 0, mtimeMs: Date.now() } as unknown as Stats)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(vi.mocked(readdir) as any).mockImplementation(async (dirPath: any) => {
      const p = String(dirPath)
      if (p.includes('DerivedData')) {
        return [makeDirent('MyProject-abcdefghijklmnopqrstuvwx', true), makeDirent('OtherApp-zyxwvutsrqponmlkjihgfedcb', true)]
      }
      return []
    })
    runExternalCommand.mockRejectedValue({ kind: 'command_not_found', message: 'xcrun not found', stdout: '', stderr: '' })

    const { scanXcode } = await import('../../src/main/services/xcodeAnalyzer')
    const result = await scanXcode()

    expect(result.status).toBe('ready')
    expect(result.summary).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'derivedDataProjects', value: '2' })]))
    const ddItems = result.reclaimable.filter((item) => item.category === 'derived_data')
    expect(ddItems).toHaveLength(2)
    expect(ddItems[0].label).toContain('MyProject')
  })

  it('should parse simulator JSON and identify unavailable devices', async () => {
    const { stat, readdir } = await import('node:fs/promises')
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true, isFile: () => false, size: 0, mtimeMs: Date.now() } as unknown as Stats)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(vi.mocked(readdir) as any).mockResolvedValue([])

    runExternalCommand.mockResolvedValue({
      stdout: JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-17-0': [
            { name: 'iPhone 15', udid: 'aaa-111', state: 'Shutdown', isAvailable: true },
            { name: 'iPhone 14', udid: 'bbb-222', state: 'Shutdown', isAvailable: false, dataPath: '/tmp/sim-data' }
          ],
          'com.apple.CoreSimulator.SimRuntime.iOS-16-0': [
            { name: 'iPhone 13', udid: 'ccc-333', state: 'Shutdown', isAvailable: false, dataPath: '/tmp/sim-old' }
          ]
        }
      }),
      stderr: ''
    })

    const { scanXcode } = await import('../../src/main/services/xcodeAnalyzer')
    const result = await scanXcode()

    expect(result.status).toBe('ready')
    expect(result.summary).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'simulators', value: '3' }),
      expect.objectContaining({ key: 'unavailableSimulators', value: '2' })
    ]))
    const simItems = result.reclaimable.filter((item) => item.category === 'simulator')
    expect(simItems).toHaveLength(2)
  })
})
