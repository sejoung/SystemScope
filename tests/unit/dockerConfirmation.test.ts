import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ focused: null as null | { isDestroyed: () => boolean }, windows: [] as Array<{ isDestroyed: () => boolean }> }))
const showMessageBox = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: () => state.focused,
    getAllWindows: () => state.windows,
  },
  dialog: { showMessageBox },
}))
vi.mock('../../src/main/i18n', () => ({ tk: (key: string, values?: { count?: number }) => values?.count === undefined ? key : `${key}:${values.count}` }))

import { buildTargetDetailLines, getActiveWindow, showConfirmDialog } from '../../src/main/ipc/docker/dockerConfirmation'

describe('Docker confirmation', () => {
  beforeEach(() => {
    state.focused = null
    state.windows = []
    showMessageBox.mockReset()
  })

  it('uses a focused live window, falls back to the first window, and rejects destroyed windows', () => {
    const fallback = { isDestroyed: () => false }
    state.windows = [fallback]
    expect(getActiveWindow()).toBe(fallback)
    state.focused = { isDestroyed: () => true }
    expect(getActiveWindow()).toBeNull()
  })

  it('limits displayed targets and reports the omitted count', () => {
    expect(buildTargetDetailLines(['1', '2', '3', '4', '5', '6', '7'], 7, ['footer'])).toEqual([
      '1', '2', '3', '4', '5', 'docker.ipc.confirm.more:2', '', 'footer',
    ])
  })

  it('returns false without a window and maps dialog responses to confirmation', async () => {
    await expect(showConfirmDialog({ actionButton: 'Delete', title: 'title', message: 'message', detailLines: [] })).resolves.toBe(false)

    state.focused = { isDestroyed: () => false }
    showMessageBox.mockResolvedValueOnce({ response: 0 })
    await expect(showConfirmDialog({ actionButton: 'Delete', title: 'title', message: 'message', detailLines: ['one', null] })).resolves.toBe(false)
    showMessageBox.mockResolvedValueOnce({ response: 1 })
    await expect(showConfirmDialog({ actionButton: 'Delete', title: 'title', message: 'message', detailLines: ['one'] })).resolves.toBe(true)
  })
})
