import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppRelatedDataItem, InstalledApp } from '../../src/shared/types'

const shellTrashItem = vi.hoisted(() => vi.fn())
const access = vi.hoisted(() => vi.fn())
const finderTrash = vi.hoisted(() => vi.fn())
const platformState = vi.hoisted(() => ({ value: 'darwin' }))
const candidates = vi.hoisted(() => [] as AppRelatedDataItem[])

vi.mock('electron', () => ({ shell: { trashItem: shellTrashItem } }))
vi.mock('node:fs/promises', () => ({ access }))
vi.mock('node:os', () => ({ homedir: () => '/Users/test', platform: () => platformState.value }))
vi.mock('../../src/main/services/apps/installedApps.mac', () => ({
  getMacRelatedDataCandidates: () => candidates,
  moveMacAppToTrashWithFinder: finderTrash,
}))
vi.mock('../../src/main/services/apps/installedApps.windows', () => ({ getWindowsRelatedDataCandidates: () => candidates }))
vi.mock('../../src/main/services/core/logging', () => ({ logInfo: vi.fn(), logWarn: vi.fn() }))
vi.mock('../../src/main/i18n', () => ({ tk: (key: string, values?: Record<string, unknown>) => `${key}:${JSON.stringify(values ?? {})}` }))

import {
  buildRemovalMessage,
  listRelatedDataForApp,
  trashPathWithFallback,
  trashRelatedDataForApp,
} from '../../src/main/services/apps/installedAppRelatedData'

const app: InstalledApp = {
  id: 'app',
  name: 'App',
  installLocation: '/Applications/App.app',
  platform: 'mac',
  uninstallKind: 'trash_app',
  protected: false,
}

describe('installed app related data', () => {
  beforeEach(() => {
    candidates.splice(0)
    shellTrashItem.mockReset()
    access.mockReset()
    finderTrash.mockReset()
    platformState.value = 'darwin'
  })

  it('returns only candidates that still exist', async () => {
    candidates.push(
      { id: 'one', path: '/data/one', label: 'one', source: 'cache' },
      { id: 'two', path: '/data/two', label: 'two', source: 'logs' },
    )
    access.mockImplementation(async (targetPath: string) => {
      if (targetPath === '/data/two') throw new Error('missing')
    })

    await expect(listRelatedDataForApp(app)).resolves.toEqual([candidates[0]])
  })

  it('deduplicates selected IDs, ignores unknown IDs, and reports individual failures', async () => {
    candidates.push(
      { id: 'one', path: '/data/one', label: 'one', source: 'cache' },
      { id: 'two', path: '/data/two', label: 'two', source: 'logs' },
    )
    access.mockResolvedValue(undefined)
    shellTrashItem.mockImplementation(async (targetPath: string) => {
      if (targetPath === '/data/two') throw new Error('trash failed')
    })
    finderTrash.mockImplementation(async (targetPath: string) => {
      if (targetPath === '/data/two') throw new Error('finder failed')
    })

    await expect(trashRelatedDataForApp(app, ['one', 'one', 'missing', 'two'])).resolves.toEqual({
      deletedPaths: ['/data/one'],
      failedPaths: ['/data/two'],
    })
    expect(shellTrashItem).toHaveBeenCalledTimes(2)
  })

  it('uses Finder fallback only on macOS', async () => {
    shellTrashItem.mockRejectedValue(new Error('native failure'))
    finderTrash.mockResolvedValue(undefined)
    await expect(trashPathWithFallback('/Applications/App.app')).resolves.toBeUndefined()
    expect(finderTrash).toHaveBeenCalledOnce()

    platformState.value = 'win32'
    await expect(trashPathWithFallback('C:\\App')).rejects.toThrow('native failure')
  })

  it('builds unchanged, complete, and partial result messages', () => {
    expect(buildRemovalMessage('removed', 0, 0)).toBe('removed')
    expect(buildRemovalMessage('removed', 2, 0)).toContain('with_related_all')
    expect(buildRemovalMessage('removed', 1, 1)).toContain('with_related_partial')
  })
})
