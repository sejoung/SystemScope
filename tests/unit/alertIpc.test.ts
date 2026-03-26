import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const logErrorAction = vi.hoisted(() => vi.fn())
const logWarnAction = vi.hoisted(() => vi.fn())
const logInfoAction = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

vi.mock('../../src/main/services/logging', () => ({
  logErrorAction,
  logWarnAction,
  logInfoAction
}))

describe('registerAlertIpc', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    logErrorAction.mockReset()
    logWarnAction.mockReset()
    logInfoAction.mockReset()
  })

  it('should return active alerts and allow dismissing them', async () => {
    const { registerAlertIpc } = await import('../../src/main/ipc/alert.ipc')
    const { checkAlerts } = await import('../../src/main/services/alertManager')
    registerAlertIpc()

    checkAlerts({
      cpu: { usage: 20, cores: [20], temperature: null, model: 'CPU', speed: 3.2 },
      memory: {
        total: 16_000_000_000,
        used: 2_000_000_000,
        active: 2_000_000_000,
        available: 14_000_000_000,
        cached: 0,
        usage: 10,
        swapTotal: 0,
        swapUsed: 0
      },
      gpu: {
        available: false,
        model: 'GPU',
        usage: null,
        memoryTotal: null,
        memoryUsed: null,
        temperature: null,
        unavailableReason: null
      },
      disk: {
        io: {
          readsPerSecond: null,
          writesPerSecond: null,
          totalPerSecond: null,
          busyPercent: null
        },
        drives: [{
          fs: '/dev/disk1s1',
          type: 'apfs',
          size: 100,
          used: 95,
          available: 5,
          usage: 95,
          mount: '/',
          purgeable: null,
          realUsage: null
        }]
      },
      network: {
        downloadBytesPerSecond: null,
        uploadBytesPerSecond: null,
        totalDownloadedBytes: null,
        totalUploadedBytes: null,
        interfaces: []
      },
      timestamp: Date.now()
    })

    const getActiveHandler = handlers.get(IPC_CHANNELS.ALERT_GET_ACTIVE)
    const dismissHandler = handlers.get(IPC_CHANNELS.ALERT_DISMISS)

    expect(getActiveHandler).toBeTypeOf('function')
    expect(dismissHandler).toBeTypeOf('function')

    const activeResult = getActiveHandler?.({}, undefined) as { ok: boolean; data: { id: string }[] }
    expect(activeResult.ok).toBe(true)
    expect(activeResult.data).toHaveLength(1)

    const dismissResult = dismissHandler?.({}, activeResult.data[0].id) as { ok: boolean }
    expect(dismissResult.ok).toBe(true)
    expect(logInfoAction).toHaveBeenCalled()

    const afterDismiss = getActiveHandler?.({}, undefined) as { ok: boolean; data: unknown[] }
    expect(afterDismiss.ok).toBe(true)
    expect(afterDismiss.data).toHaveLength(0)
  })

  it('should reject invalid or unknown alert ids', async () => {
    const { registerAlertIpc } = await import('../../src/main/ipc/alert.ipc')
    registerAlertIpc()

    const dismissHandler = handlers.get(IPC_CHANNELS.ALERT_DISMISS)
    expect(dismissHandler).toBeTypeOf('function')

    const invalidResult = dismissHandler?.({}, '') as { ok: boolean; error?: { code: string } }
    expect(invalidResult.ok).toBe(false)
    expect(invalidResult.error?.code).toBe('INVALID_INPUT')
    expect(logWarnAction).toHaveBeenCalled()

    const unknownResult = dismissHandler?.({}, 'missing-id') as { ok: boolean; error?: { code: string } }
    expect(unknownResult.ok).toBe(false)
    expect(unknownResult.error?.code).toBe('UNKNOWN_ERROR')
    expect(logWarnAction).toHaveBeenCalled()
  })
})
