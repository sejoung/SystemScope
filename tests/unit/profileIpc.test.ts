import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'
import { DEFAULT_THRESHOLDS } from '../../src/shared/types'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const getProfilesMock = vi.hoisted(() => vi.fn())
const saveProfileMock = vi.hoisted(() => vi.fn())
const deleteProfileMock = vi.hoisted(() => vi.fn())
const setActiveProfileMock = vi.hoisted(() => vi.fn())
const logInfoActionMock = vi.hoisted(() => vi.fn())
const logErrorActionMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

vi.mock('../../src/main/services/profileManager', () => ({
  getProfiles: getProfilesMock,
  saveProfile: saveProfileMock,
  deleteProfile: deleteProfileMock,
  setActiveProfile: setActiveProfileMock
}))

vi.mock('../../src/main/services/logging', () => ({
  logInfoAction: logInfoActionMock,
  logErrorAction: logErrorActionMock
}))

describe('registerProfileIpc', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    getProfilesMock.mockReset()
    saveProfileMock.mockReset()
    deleteProfileMock.mockReset()
    setActiveProfileMock.mockReset()
    logInfoActionMock.mockReset()
    logErrorActionMock.mockReset()
  })

  it('should reject malformed profile payloads before saving', async () => {
    const { registerProfileIpc } = await import('../../src/main/ipc/profile.ipc')
    registerProfileIpc()

    const handler = handlers.get(IPC_CHANNELS.PROFILE_SAVE)
    const result = await handler?.({}, {
      id: '',
      name: 'Broken',
      icon: 'x',
      thresholds: { cpuWarning: 80 },
      cleanupRules: [],
      hiddenWidgets: [],
      workspacePaths: [],
      automationSchedule: null
    }) as { ok: boolean; error?: { code: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('INVALID_INPUT')
    expect(saveProfileMock).not.toHaveBeenCalled()
  })

  it('should accept valid profile payloads', async () => {
    saveProfileMock.mockReturnValue({
      id: 'profile-1',
      name: 'Development',
      icon: 'dev',
      thresholds: DEFAULT_THRESHOLDS,
      cleanupRules: [{ id: 'npm_cache', enabled: true, minAgeDays: 14 }],
      hiddenWidgets: ['gpu'],
      workspacePaths: ['/Users/test/workspace'],
      automationSchedule: null
    })

    const { registerProfileIpc } = await import('../../src/main/ipc/profile.ipc')
    registerProfileIpc()

    const handler = handlers.get(IPC_CHANNELS.PROFILE_SAVE)
    const result = await handler?.({}, {
      id: '',
      name: 'Development',
      icon: 'dev',
      thresholds: DEFAULT_THRESHOLDS,
      cleanupRules: [{ id: 'npm_cache', enabled: true, minAgeDays: 14 }],
      hiddenWidgets: ['gpu'],
      workspacePaths: ['/Users/test/workspace'],
      automationSchedule: null
    }) as { ok: boolean; data?: { id: string } }

    expect(result.ok).toBe(true)
    expect(result.data?.id).toBe('profile-1')
    expect(saveProfileMock).toHaveBeenCalledTimes(1)
  })
})
