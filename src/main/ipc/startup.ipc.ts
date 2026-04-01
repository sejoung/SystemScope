import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import { getStartupItems, toggleStartupItem } from '../services/startupManager'
import { logInfoAction, logErrorAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerStartupIpc(): void {
  ipcMain.handle(IPC_CHANNELS.STARTUP_GET_ALL, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const items = await getStartupItems()
      logInfoAction('startup-ipc', 'startup.getAll', withRequestMeta(requestMeta, { count: items.length }))
      return success(items)
    } catch (err) {
      logErrorAction('startup-ipc', 'startup.getAll', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get startup items')
    }
  })

  ipcMain.handle(IPC_CHANNELS.STARTUP_TOGGLE, async (_event, id: string, enabled: boolean, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      if (!id || typeof id !== 'string' || typeof enabled !== 'boolean') {
        return failure('INVALID_INPUT', 'Startup item ID and enabled flag are required')
      }
      const result = await toggleStartupItem(id, enabled)
      logInfoAction('startup-ipc', 'startup.toggle', withRequestMeta(requestMeta, { id, enabled, success: result.success }))
      return success(result)
    } catch (err) {
      logErrorAction('startup-ipc', 'startup.toggle', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to toggle startup item')
    }
  })
}
