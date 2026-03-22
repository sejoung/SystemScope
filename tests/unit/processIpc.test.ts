import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const logError = vi.hoisted(() => vi.fn())
const getNetworkPorts = vi.hoisted(() => vi.fn())
const getProcessByPid = vi.hoisted(() => vi.fn())
const showMessageBox = vi.hoisted(() => vi.fn())
const getFocusedWindow = vi.hoisted(() => vi.fn())
const getAllWindows = vi.hoisted(() => vi.fn())
const getAppName = vi.hoisted(() => vi.fn())
const getAppPath = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  dialog: {
    showMessageBox
  },
  BrowserWindow: {
    getFocusedWindow,
    getAllWindows
  },
  app: {
    getName: getAppName,
    getPath: getAppPath
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
  getNetworkPorts,
  getProcessByPid
}))

describe('registerProcessIpc', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    logError.mockReset()
    getNetworkPorts.mockReset()
    getProcessByPid.mockReset()
    showMessageBox.mockReset()
    getFocusedWindow.mockReset()
    getAllWindows.mockReset()
    getAppName.mockReset()
    getAppPath.mockReset()

    getFocusedWindow.mockReturnValue(null)
    getAllWindows.mockReturnValue([])
    getAppName.mockReturnValue('SystemScope')
    getAppPath.mockImplementation((name: string) => {
      if (name === 'exe') return '/Applications/SystemScope.app/Contents/MacOS/SystemScope'
      return '/tmp'
    })
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

  it('should kill a process after confirmation', async () => {
    const target = { pid: 4321, name: 'node', command: '/usr/bin/node', cpu: 0, memory: 0, memoryBytes: 0 }
    getProcessByPid.mockResolvedValue(target)
    showMessageBox.mockResolvedValue({ response: 1 })
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    const { registerProcessIpc } = await import('../../src/main/ipc/process.ipc')
    registerProcessIpc()

    const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, { pid: 4321, reason: 'Activity > Processes' }) as { ok: boolean; data?: { killed: boolean; cancelled: boolean } }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ pid: 4321, name: 'node', killed: true, cancelled: false })
    expect(showMessageBox).toHaveBeenCalled()
    expect(killSpy).toHaveBeenCalledWith(4321, 'SIGTERM')
    killSpy.mockRestore()
  })

  it('should return cancelled result when user aborts kill', async () => {
    getProcessByPid.mockResolvedValue({ pid: 4321, name: 'node', command: '/usr/bin/node', cpu: 0, memory: 0, memoryBytes: 0 })
    showMessageBox.mockResolvedValue({ response: 0 })
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    const { registerProcessIpc } = await import('../../src/main/ipc/process.ipc')
    registerProcessIpc()

    const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, { pid: 4321 }) as { ok: boolean; data?: { killed: boolean; cancelled: boolean } }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ pid: 4321, name: 'node', killed: false, cancelled: true })
    expect(killSpy).not.toHaveBeenCalled()
    killSpy.mockRestore()
  })

  it('should block protected app processes', async () => {
    getProcessByPid.mockResolvedValue({
      pid: 1234,
      name: 'SystemScope Helper',
      command: '/Applications/SystemScope.app/Contents/MacOS/SystemScope',
      cpu: 0,
      memory: 0,
      memoryBytes: 0
    })

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const { registerProcessIpc } = await import('../../src/main/ipc/process.ipc')
    registerProcessIpc()

    const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, { pid: 1234 }) as { ok: boolean; error?: { code: string } }
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('PERMISSION_DENIED')
    expect(killSpy).not.toHaveBeenCalled()
    killSpy.mockRestore()
  })
})
