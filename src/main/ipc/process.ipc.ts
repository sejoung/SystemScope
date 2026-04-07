import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import type { ProcessKillRequest, ProcessKillResult } from '@shared/types'
import { getTopCpuProcesses, getTopMemoryProcesses, getAllProcesses, getNetworkPorts, getProcessByPid, getProcessSnapshot } from '../services/processMonitor'
import { getProcessNetworkUsage } from '../services/processNetworkMonitor'
import { resolveHostnames } from '../services/dnsResolver'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction, logProductMetric, logWarnAction } from '../services/logging'
import { runExternalCommand } from '../services/externalCommand'
import { tk } from '../i18n'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerProcessIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_TOP_CPU, async (_event, limit: number = 10, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return failure('INVALID_INPUT', tk('main.process.error.invalid_limit'))
    }
    try {
      const processes = await getTopCpuProcesses(limit)
      logInfoAction('process-ipc', 'processes.top_cpu.list', withRequestMeta(requestMeta, { limit, count: processes.length }))
      return success(processes)
    } catch (err) {
      logErrorAction('process-ipc', 'processes.top_cpu.list', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.process.error.fetch_processes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_TOP_MEMORY, async (_event, limit: number = 10, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return failure('INVALID_INPUT', tk('main.process.error.invalid_limit'))
    }
    try {
      const processes = await getTopMemoryProcesses(limit)
      logInfoAction('process-ipc', 'processes.top_memory.list', withRequestMeta(requestMeta, { limit, count: processes.length }))
      return success(processes)
    } catch (err) {
      logErrorAction('process-ipc', 'processes.top_memory.list', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.process.error.fetch_processes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_ALL, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const processes = await getAllProcesses()
      logInfoAction('process-ipc', 'processes.all.list', withRequestMeta(requestMeta, { count: processes.length }))
      return success(processes)
    } catch (err) {
      logErrorAction('process-ipc', 'processes.all.list', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.process.error.fetch_processes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_SNAPSHOT, async (_event, limit: number = 10, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return failure('INVALID_INPUT', tk('main.process.error.invalid_limit'))
    }
    try {
      const snapshot = await getProcessSnapshot(limit)
      logInfoAction('process-ipc', 'processes.snapshot.get', withRequestMeta(requestMeta, {
        limit,
        allCount: snapshot.allProcesses.length
      }))
      return success(snapshot)
    } catch (err) {
      logErrorAction('process-ipc', 'processes.snapshot.get', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.process.error.fetch_processes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_PORTS, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const ports = await getNetworkPorts()
      logInfoAction('process-ipc', 'ports.list', withRequestMeta(requestMeta, { count: ports.length }))
      logProductMetric('process-ipc', 'ports.scan', 'succeeded', withRequestMeta(requestMeta, { count: ports.length }))
      return success(ports)
    } catch (err) {
      logErrorAction('process-ipc', 'ports.list', withRequestMeta(requestMeta, { error: err }))
      logProductMetric('process-ipc', 'ports.scan', 'failed', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.process.error.fetch_ports'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_NETWORK_USAGE, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const snapshot = await getProcessNetworkUsage()
      logInfoAction('process-ipc', 'network.usage.get', withRequestMeta(requestMeta, {
        supported: snapshot.supported,
        count: snapshot.processes.length,
      }))
      return success(snapshot)
    } catch (err) {
      logErrorAction('process-ipc', 'network.usage.get', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.process.error.fetch_processes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_RESOLVE_HOSTNAMES, async (_event, payload: unknown, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!Array.isArray(payload) || !payload.every((item) => typeof item === 'string')) {
      logWarnAction('process-ipc', 'dns.resolve', withRequestMeta(requestMeta, { reason: 'invalid_input' }))
      return failure('INVALID_INPUT', tk('main.process.error.fetch_processes'))
    }
    try {
      const result = await resolveHostnames(payload)
      logInfoAction('process-ipc', 'dns.resolve', withRequestMeta(requestMeta, { count: payload.length }))
      return success(result)
    } catch (err) {
      logErrorAction('process-ipc', 'dns.resolve', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.process.error.fetch_processes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_KILL, async (_event, request: ProcessKillRequest, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!request || typeof request !== 'object' || !Number.isInteger(request.pid) || request.pid < 1) {
      logWarnAction('process-ipc', 'process.kill', withRequestMeta(requestMeta, { reason: 'invalid_pid', request }))
      return failure('INVALID_INPUT', tk('main.process.error.invalid_pid'))
    }

    try {
      const target = await getProcessByPid(request.pid)
      if (!target) {
        logWarnAction('process-ipc', 'process.kill', withRequestMeta(requestMeta, { reason: 'not_found', pid: request.pid }))
        return failure('UNKNOWN_ERROR', tk('main.process.error.not_found'))
      }
      if (isProtectedProcess(target)) {
        logWarnAction('process-ipc', 'process.kill', withRequestMeta(requestMeta, { reason: 'protected', pid: target.pid, name: target.name }))
        return failure('PERMISSION_DENIED', tk('main.process.error.protected'))
      }

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const detailLines = [
        `PID: ${target.pid}`,
        `Name: ${target.name}`,
        target.command ? `Command: ${target.command}` : null,
        request.reason ? `Reason: ${request.reason}` : null,
        '',
        tk('main.process.confirm.warning')
      ].filter(Boolean)

      const confirm = await dialog.showMessageBox(win ?? undefined, {
        type: 'warning',
        buttons: [tk('main.process.confirm.cancel'), tk('main.process.confirm.kill')],
        defaultId: 0,
        cancelId: 0,
        title: tk('main.process.confirm.title'),
        message: tk('main.process.confirm.message', { name: target.name }),
        detail: detailLines.join('\n')
      })

      if (confirm.response === 0) {
        logInfoAction('process-ipc', 'process.kill.cancel', withRequestMeta(requestMeta, { pid: target.pid, name: target.name }))
        logProductMetric('process-ipc', 'process.kill', 'cancelled', withRequestMeta(requestMeta, { pid: target.pid, name: target.name }))
        const result: ProcessKillResult = {
          pid: target.pid,
          name: target.name,
          killed: false,
          cancelled: true
        }
        return success(result)
      }

      const confirmedTarget = await getProcessByPid(request.pid)
      if (!confirmedTarget || confirmedTarget.name !== target.name || confirmedTarget.command !== target.command) {
        logWarnAction('process-ipc', 'process.kill', withRequestMeta(requestMeta, { reason: 'target_changed', pid: request.pid }))
        return failure('UNKNOWN_ERROR', tk('main.process.error.changed'))
      }

      await terminateProcess(confirmedTarget.pid)
      logInfoAction('process-ipc', 'process.kill', withRequestMeta(requestMeta, { pid: confirmedTarget.pid, name: confirmedTarget.name }))
      logProductMetric('process-ipc', 'process.kill', 'succeeded', withRequestMeta(requestMeta, { pid: confirmedTarget.pid, name: confirmedTarget.name }))

      const result: ProcessKillResult = {
        pid: confirmedTarget.pid,
        name: confirmedTarget.name,
        killed: true,
        cancelled: false
      }
      return success(result)
    } catch (err) {
      logErrorAction('process-ipc', 'process.kill', withRequestMeta(requestMeta, { error: err }))
      logProductMetric('process-ipc', 'process.kill', 'failed', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.process.error.kill_failed'))
    }
  })
}

async function terminateProcess(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM')
    return
  } catch (error) {
    if (!shouldFallbackToTaskkill(error)) {
      throw error
    }
  }

  await runExternalCommand('taskkill', ['/PID', String(pid), '/T', '/F'], {
    windowsHide: true
  })
}

function shouldFallbackToTaskkill(error: unknown): boolean {
  if (process.platform !== 'win32') {
    return false
  }

  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: string }).code
    : undefined

  return code === 'EPERM' || code === 'EACCES'
}

function isProtectedProcess(target: { pid: number; name: string; command: string }): boolean {
  if (target.pid === process.pid) return true

  const appName = app.getName().toLowerCase()
  const exePath = app.getPath('exe').toLowerCase()
  const targetName = target.name.toLowerCase()
  const targetCommand = target.command.toLowerCase()

  // 정확한 이름 매칭 또는 단어 경계 확인 — "horoscope" 같은 오탐 방지
  const nameMatch = targetName === appName
    || targetName.startsWith(appName + '.')
    || targetName.startsWith(appName + ' ')
  return nameMatch || targetCommand.includes(exePath)
}
