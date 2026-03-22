import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import type { ProcessKillRequest, ProcessKillResult } from '@shared/types'
import { getTopCpuProcesses, getTopMemoryProcesses, getAllProcesses, getNetworkPorts, getProcessByPid } from '../services/processMonitor'
import { success, failure } from '@shared/types'
import { logError, logInfo, logWarn } from '../services/logging'

export function registerProcessIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_TOP_CPU, async (_event, limit: number = 10) => {
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return failure('INVALID_INPUT', '유효하지 않은 limit 값입니다.')
    }
    try {
      const processes = await getTopCpuProcesses(limit)
      return success(processes)
    } catch (err) {
      logError('process-ipc', 'Failed to get CPU processes', err)
      return failure('UNKNOWN_ERROR', '프로세스 정보를 가져올 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_TOP_MEMORY, async (_event, limit: number = 10) => {
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return failure('INVALID_INPUT', '유효하지 않은 limit 값입니다.')
    }
    try {
      const processes = await getTopMemoryProcesses(limit)
      return success(processes)
    } catch (err) {
      logError('process-ipc', 'Failed to get memory processes', err)
      return failure('UNKNOWN_ERROR', '프로세스 정보를 가져올 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_ALL, async () => {
    try {
      const processes = await getAllProcesses()
      return success(processes)
    } catch (err) {
      logError('process-ipc', 'Failed to get all processes', err)
      return failure('UNKNOWN_ERROR', '프로세스 정보를 가져올 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_PORTS, async () => {
    try {
      const ports = await getNetworkPorts()
      return success(ports)
    } catch (err) {
      logError('process-ipc', 'Failed to get network ports', err)
      return failure('UNKNOWN_ERROR', '포트 정보를 가져올 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_KILL, async (_event, request: ProcessKillRequest) => {
    if (!request || typeof request !== 'object' || !Number.isInteger(request.pid) || request.pid < 1) {
      logWarn('process-ipc', 'Process kill rejected due to invalid PID', { request })
      return failure('INVALID_INPUT', '유효하지 않은 PID입니다.')
    }

    try {
      const target = await getProcessByPid(request.pid)
      if (!target) {
        logWarn('process-ipc', 'Process kill failed because target was not found', { pid: request.pid })
        return failure('UNKNOWN_ERROR', '프로세스를 찾을 수 없습니다.')
      }
      if (isProtectedProcess(target)) {
        logWarn('process-ipc', 'Process kill blocked for protected target', { pid: target.pid, name: target.name })
        return failure('PERMISSION_DENIED', '앱 자신이나 보호된 프로세스는 종료할 수 없습니다.')
      }

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const detailLines = [
        `PID: ${target.pid}`,
        `Name: ${target.name}`,
        target.command ? `Command: ${target.command}` : null,
        request.reason ? `Reason: ${request.reason}` : null,
        '',
        '저장되지 않은 작업이 손실될 수 있습니다.'
      ].filter(Boolean)

      const confirm = await dialog.showMessageBox(win ?? undefined, {
        type: 'warning',
        buttons: ['Cancel', 'Kill'],
        defaultId: 0,
        cancelId: 0,
        title: 'Kill Process',
        message: `"${target.name}" 프로세스를 종료하시겠습니까?`,
        detail: detailLines.join('\n')
      })

      if (confirm.response === 0) {
        logInfo('process-ipc', 'Process kill cancelled by user', { pid: target.pid, name: target.name })
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
        logWarn('process-ipc', 'Process kill aborted because target changed before termination', { pid: request.pid })
        return failure('UNKNOWN_ERROR', '프로세스 상태가 변경되어 종료를 중단했습니다.')
      }

      process.kill(request.pid, 'SIGTERM')
      logInfo('process-ipc', 'Process kill signal sent', { pid: confirmedTarget.pid, name: confirmedTarget.name })

      const result: ProcessKillResult = {
        pid: confirmedTarget.pid,
        name: confirmedTarget.name,
        killed: true,
        cancelled: false
      }
      return success(result)
    } catch (err) {
      logError('process-ipc', 'Failed to kill process', err)
      return failure('UNKNOWN_ERROR', '프로세스를 종료할 수 없습니다.')
    }
  })
}

function isProtectedProcess(target: { pid: number; name: string; command: string }): boolean {
  if (target.pid === process.pid) return true

  const appName = app.getName().toLowerCase()
  const exePath = app.getPath('exe').toLowerCase()
  const targetName = target.name.toLowerCase()
  const targetCommand = target.command.toLowerCase()

  return targetName.includes(appName) || targetCommand.includes(exePath)
}
