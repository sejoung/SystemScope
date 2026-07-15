import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiskScanResult, DuplicateGroup, LargeFile } from '../../src/shared/types'

const registerShellPath = vi.hoisted(() => vi.fn())
let uuidIndex = 0

vi.mock('node:crypto', () => ({ randomUUID: () => `key-${++uuidIndex}` }))
vi.mock('../../src/main/services/devtools', () => ({ registerShellPath }))

import {
  getScanCache,
  invalidateScanCache,
  registerDuplicateTrashTargets,
  registerLargeFileTrashTargets,
  removeTrashedTargets,
  resolveTrashTargets,
  setScanCache,
} from '../../src/main/ipc/disk/diskIpcState'

function scan(rootPath: string): DiskScanResult {
  return {
    rootPath,
    tree: { name: 'root', path: rootPath, size: 1, children: [], isFile: false },
    totalSize: 1,
    fileCount: 1,
    folderCount: 1,
    inaccessibleCount: 0,
    scanDuration: 1,
  }
}

function largeFile(filePath: string): LargeFile {
  return { name: filePath.split('/').pop() ?? filePath, path: filePath, size: 10, modified: 1 }
}

describe('disk IPC state', () => {
  beforeEach(() => {
    vi.useRealTimers()
    uuidIndex = 0
    registerShellPath.mockReset()
    for (let index = 0; index < 8; index += 1) invalidateScanCache(`/tmp/cache-${index}`)
    invalidateScanCache('/tmp/root')
  })

  it('normalizes cache paths, expires entries, and evicts the oldest cache', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    setScanCache(scan('/tmp/root/../root'))
    expect(getScanCache('/tmp/root')).not.toBeNull()
    expect(registerShellPath).toHaveBeenCalledWith('/tmp/root/../root')

    for (let index = 0; index < 6; index += 1) setScanCache(scan(`/tmp/cache-${index}`))
    expect(getScanCache('/tmp/root')).toBeNull()

    vi.setSystemTime(30 * 60 * 1000)
    expect(getScanCache('/tmp/cache-1')).toBeNull()
  })

  it('resolves registered deletion keys atomically and removes trashed paths', () => {
    const registered = registerLargeFileTrashTargets(
      [largeFile('/tmp/root/a.log'), largeFile('/tmp/root/b.log')],
      '/tmp/root/../root',
      'large',
    )
    const keys = registered.map((file) => file.deletionKey as string)

    expect(resolveTrashTargets(keys)?.map((target) => target.rootPath)).toEqual(['/tmp/root', '/tmp/root'])
    expect(resolveTrashTargets([keys[0], 'unknown'])).toBeNull()

    removeTrashedTargets(['/tmp/root/../root/a.log'])
    expect(resolveTrashTargets([keys[0]])).toBeNull()
    expect(resolveTrashTargets([keys[1]])?.[0].path).toBe('/tmp/root/b.log')
  })

  it('protects the first duplicate and expires deletion keys after one hour', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const groups: DuplicateGroup[] = [{
      hash: 'hash',
      size: 10,
      totalWaste: 10,
      files: [
        { name: 'keep', path: '/tmp/root/keep', modified: 1 },
        { name: 'delete', path: '/tmp/root/delete', modified: 1 },
      ],
    }]
    const registered = registerDuplicateTrashTargets(groups, '/tmp/root')
    expect(registered[0].files[0].deletionKey).toBeUndefined()
    const deletionKey = registered[0].files[1].deletionKey as string
    expect(resolveTrashTargets([deletionKey])).not.toBeNull()

    vi.setSystemTime(60 * 60 * 1000 + 1)
    expect(resolveTrashTargets([deletionKey])).toBeNull()
  })
})
