import { beforeEach, describe, expect, it, vi } from 'vitest'

const showMessageBox = vi.hoisted(() => vi.fn())
const trashItem = vi.hoisted(() => vi.fn())
const getPath = vi.hoisted(() => vi.fn())
const statSync = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  dialog: {
    showMessageBox
  },
  shell: {
    trashItem
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => ({ id: 1, isDestroyed: () => false })),
    getAllWindows: vi.fn(() => [{ id: 1, isDestroyed: () => false }])
  },
  app: {
    getPath
  }
}))

vi.mock('fs', () => ({
  default: {
    statSync
  },
  statSync
}))

describe('trashService', () => {
  beforeEach(() => {
    showMessageBox.mockReset()
    trashItem.mockReset()
    getPath.mockReset()
    statSync.mockReset()

    getPath.mockReturnValue('/Users/test')
    showMessageBox.mockResolvedValue({ response: 1 })
    statSync.mockImplementation((targetPath: string) => ({
      size: targetPath.includes('a') ? 100 : 200
    }))
  })

  it('returns exact trashed paths when some items fail', async () => {
    trashItem.mockImplementation(async (targetPath: string) => {
      if (targetPath.endsWith('b.log')) {
        throw new Error('permission denied')
      }
    })

    const { trashItemsWithConfirm } = await import('../../src/main/services/trashService')
    const result = await trashItemsWithConfirm(
      ['/Users/test/a.log', '/Users/test/b.log', '/Users/test/c.log'],
      'test'
    )

    expect(result.successCount).toBe(2)
    expect(result.failCount).toBe(1)
    expect(result.trashedPaths).toEqual(['/Users/test/a.log', '/Users/test/c.log'])
    expect(result.errors).toHaveLength(1)
  })

  it('returns empty trashed paths when user cancels', async () => {
    showMessageBox.mockResolvedValue({ response: 0 })

    const { trashItemsWithConfirm } = await import('../../src/main/services/trashService')
    const result = await trashItemsWithConfirm(['/Users/test/a.log'], 'test')

    expect(result.successCount).toBe(0)
    expect(result.failCount).toBe(0)
    expect(result.trashedPaths).toEqual([])
  })
})
