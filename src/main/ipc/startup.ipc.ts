import { shell } from 'electron'
import { ipcMain } from './_shared/trustedIpc'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import { getStartupItems, getStartupItemsWithSystemSettings, toggleStartupItem, findOrphanedLaunchAgents, removeOrphanedLaunchAgents } from '@main/services/startup'
import { logInfoAction, logErrorAction } from '@main/services/core'
import { getRequestMeta, isValidStringArray, withRequestMeta, type IpcRequestMetaArg } from './_shared/requestContext'

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

  ipcMain.handle(IPC_CHANNELS.STARTUP_SCAN_BTM, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const items = await getStartupItemsWithSystemSettings()
      logInfoAction('startup-ipc', 'startup.scanBtm', withRequestMeta(requestMeta, { count: items.length }))
      return success(items)
    } catch (err) {
      // Most common failure: the user dismissed the macOS authorization dialog.
      logErrorAction('startup-ipc', 'startup.scanBtm', withRequestMeta(requestMeta, { error: err }))
      return failure('PERMISSION_DENIED', 'Failed to read System Settings login items')
    }
  })

  ipcMain.handle(IPC_CHANNELS.STARTUP_OPEN_SETTINGS, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      await shell.openExternal('x-apple.systempreferences:com.apple.LoginItems-Settings.extension')
      logInfoAction('startup-ipc', 'startup.openSettings', withRequestMeta(requestMeta))
      return success(true)
    } catch (err) {
      logErrorAction('startup-ipc', 'startup.openSettings', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to open System Settings')
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

  ipcMain.handle(IPC_CHANNELS.STARTUP_FIND_ORPHANS, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const orphans = await findOrphanedLaunchAgents()
      logInfoAction('startup-ipc', 'startup.findOrphans', withRequestMeta(requestMeta, { count: orphans.length }))
      return success(orphans)
    } catch (err) {
      logErrorAction('startup-ipc', 'startup.findOrphans', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to scan for orphaned launch agents')
    }
  })

  ipcMain.handle(IPC_CHANNELS.STARTUP_REMOVE_ORPHANS, async (_event, ids: unknown, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidStringArray(ids)) {
      return failure('INVALID_INPUT', 'Orphan IDs array is required')
    }
    try {
      const result = await removeOrphanedLaunchAgents(ids)
      logInfoAction('startup-ipc', 'startup.removeOrphans', withRequestMeta(requestMeta, {
        requestedCount: ids.length, removedCount: result.removedCount, failedCount: result.failedCount
      }))
      return success(result)
    } catch (err) {
      logErrorAction('startup-ipc', 'startup.removeOrphans', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to remove orphaned launch agents')
    }
  })
}
