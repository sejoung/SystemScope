import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getTopCpuProcesses, getTopMemoryProcesses, getAllProcesses } from '../services/processMonitor'
import { success, failure } from '@shared/types'
import log from 'electron-log'

export function registerProcessIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_TOP_CPU, async (_event, limit: number = 10) => {
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return failure('INVALID_INPUT', '유효하지 않은 limit 값입니다.')
    }
    try {
      const processes = await getTopCpuProcesses(limit)
      return success(processes)
    } catch (err) {
      log.error('Failed to get CPU processes', err)
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
      log.error('Failed to get memory processes', err)
      return failure('UNKNOWN_ERROR', '프로세스 정보를 가져올 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROCESS_GET_ALL, async () => {
    try {
      const processes = await getAllProcesses()
      return success(processes)
    } catch (err) {
      log.error('Failed to get all processes', err)
      return failure('UNKNOWN_ERROR', '프로세스 정보를 가져올 수 없습니다.')
    }
  })
}
