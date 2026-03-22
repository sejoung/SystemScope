import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const logError = vi.hoisted(() => vi.fn())
const getNetworkPorts = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

vi.mock('electron-log', () => ({
  default: {
    error: logError
  }
}))

vi.mock('../../src/main/services/processMonitor', () => ({
  getTopCpuProcesses: vi.fn(),
  getTopMemoryProcesses: vi.fn(),
  getAllProcesses: vi.fn(),
  getNetworkPorts
}))

describe('registerProcessIpc ports', () => {
  beforeEach(() => {
    handlers.clear()
    logError.mockReset()
    getNetworkPorts.mockReset()
  })

  it('should return ports through PROCESS_GET_PORTS', async () => {
    getNetworkPorts.mockResolvedValue([{ localPort: '3000', localPortNum: 3000 }])

    const { registerProcessIpc } = await import('../../src/main/ipc/process.ipc')
    registerProcessIpc()

    const handler = handlers.get(IPC_CHANNELS.PROCESS_GET_PORTS)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, undefined) as { ok: boolean; data?: unknown[] }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual([{ localPort: '3000', localPortNum: 3000 }])
  })

  it('should return failure when getNetworkPorts throws', async () => {
    getNetworkPorts.mockRejectedValue(new Error('boom'))

    const { registerProcessIpc } = await import('../../src/main/ipc/process.ipc')
    registerProcessIpc()

    const handler = handlers.get(IPC_CHANNELS.PROCESS_GET_PORTS)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, undefined) as { ok: boolean; error?: { code: string } }
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('UNKNOWN_ERROR')
    expect(logError).toHaveBeenCalled()
  })
})
