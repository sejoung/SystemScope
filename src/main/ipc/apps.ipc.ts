import { ipcMain, BrowserWindow, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { failure, success } from '@shared/types'
import type { AppRemovalResult, AppUninstallRequest } from '@shared/types'
import {
  getInstalledAppById,
  getInstalledAppRelatedData,
  listInstalledApps,
  listLeftoverAppData,
  listLeftoverAppRegistry,
  openInstalledAppLocation,
  removeLeftoverAppData,
  removeLeftoverAppRegistry,
  openSystemUninstallSettings,
  uninstallInstalledApp
} from '../services/installedApps'
import { logErrorAction, logInfoAction, logWarnAction } from '../services/logging'
import { tk } from '../i18n'
import { getRequestMeta, isValidStringArray, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerAppsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.APPS_LIST_INSTALLED, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const items = await listInstalledApps()
      logInfoAction('apps-ipc', 'installed.list', withRequestMeta(requestMeta, { count: items.length }))
      return success(items)
    } catch (error) {
      logErrorAction('apps-ipc', 'installed.list', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', tk('apps.error.load_installed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_OPEN_LOCATION, async (_event, appId: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!appId || typeof appId !== 'string') {
      return failure('INVALID_INPUT', 'Invalid app ID.')
    }

    try {
      await openInstalledAppLocation(appId)
      logInfoAction('apps-ipc', 'installed.open_location', withRequestMeta(requestMeta, { appId }))
      return success(true)
    } catch (error) {
      logErrorAction('apps-ipc', 'installed.open_location', withRequestMeta(requestMeta, { appId, error }))
      return failure('UNKNOWN_ERROR', tk('apps.error.open_location'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_OPEN_SYSTEM_SETTINGS, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      await openSystemUninstallSettings()
      logInfoAction('apps-ipc', 'system_settings.open', withRequestMeta(requestMeta))
      return success(true)
    } catch (error) {
      logErrorAction('apps-ipc', 'system_settings.open', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', tk('apps.error.open_system_settings'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_GET_RELATED_DATA, async (_event, appId: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!appId || typeof appId !== 'string') {
      return failure('INVALID_INPUT', 'Invalid app ID.')
    }

    try {
      const items = await getInstalledAppRelatedData(appId)
      logInfoAction('apps-ipc', 'related_data.list', withRequestMeta(requestMeta, { appId, count: items.length }))
      return success(items)
    } catch (error) {
      logErrorAction('apps-ipc', 'related_data.list', withRequestMeta(requestMeta, { appId, error }))
      return failure('UNKNOWN_ERROR', tk('apps.error.load_related'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_LIST_LEFTOVER_DATA, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const items = await listLeftoverAppData()
      logInfoAction('apps-ipc', 'leftover_data.list', withRequestMeta(requestMeta, { count: items.length }))
      return success(items)
    } catch (error) {
      logErrorAction('apps-ipc', 'leftover_data.list', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', tk('apps.error.load_leftover'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_REMOVE_LEFTOVER_DATA, async (_event, itemIds: string[], metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidStringArray(itemIds)) {
      return failure('INVALID_INPUT', 'Invalid item ID list.')
    }

    try {
      const result = await removeLeftoverAppData(itemIds)
      logInfoAction('apps-ipc', 'leftover_data.remove', {
        requestedCount: itemIds.length,
        deletedCount: result.deletedPaths.length,
        failedCount: result.failedPaths.length,
        requestId: requestMeta?.requestId
      })
      return success(result)
    } catch (error) {
      logErrorAction('apps-ipc', 'leftover_data.remove', withRequestMeta(requestMeta, { itemIds, error }))
      return failure('UNKNOWN_ERROR', tk('apps.error.remove_leftover'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_LIST_LEFTOVER_REGISTRY, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const items = await listLeftoverAppRegistry()
      logInfoAction('apps-ipc', 'leftover_registry.list', withRequestMeta(requestMeta, { count: items.length }))
      return success(items)
    } catch (error) {
      logErrorAction('apps-ipc', 'leftover_registry.list', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', tk('apps.error.load_registry'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_REMOVE_LEFTOVER_REGISTRY, async (_event, itemIds: string[], metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidStringArray(itemIds)) {
      return failure('INVALID_INPUT', 'Invalid item ID list.')
    }

    try {
      const result = await removeLeftoverAppRegistry(itemIds)
      logInfoAction('apps-ipc', 'leftover_registry.remove', {
        requestedCount: itemIds.length,
        deletedCount: result.deletedKeys.length,
        failedCount: result.failedKeys.length,
        requestId: requestMeta?.requestId
      })
      return success(result)
    } catch (error) {
      logErrorAction('apps-ipc', 'leftover_registry.remove', withRequestMeta(requestMeta, { itemIds, error }))
      return failure('UNKNOWN_ERROR', tk('apps.error.remove_registry'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_UNINSTALL, async (_event, request: AppUninstallRequest, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    const appId = request?.appId
    if (!appId || typeof appId !== 'string') {
      logWarnAction('apps-ipc', 'uninstall.start', withRequestMeta(requestMeta, { reason: 'invalid_input', appId }))
      return failure('INVALID_INPUT', 'Invalid app ID.')
    }

    const target = getInstalledAppById(appId)
    if (!target) {
      return failure('UNKNOWN_ERROR', tk('main.apps.error.not_found'))
    }
    if (target.protected) {
      return failure('PERMISSION_DENIED', target.protectedReason ?? tk('main.apps.error.protected'))
    }

    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const actionLabel = target.platform === 'mac' ? tk('main.apps.confirm.action_move_to_trash') : tk('main.apps.confirm.action_uninstall')
    const relatedDataIds = Array.isArray(request.relatedDataIds) ? request.relatedDataIds.filter((id) => typeof id === 'string' && id.trim()) : []
    const relatedDataCount = relatedDataIds.length
    const detailLines = [
      target.version ? `${tk('apps.table.version')}: ${target.version}` : null,
      target.publisher ? `${tk('apps.table.publisher')}: ${target.publisher}` : null,
      target.installLocation ? `${tk('apps.table.location')}: ${target.installLocation}` : null,
      relatedDataCount > 0 ? tk('main.apps.confirm.related_count', { count: relatedDataCount }) : null,
      '',
      target.platform === 'mac'
        ? tk('main.apps.confirm.move_detail')
        : tk('main.apps.confirm.uninstall_detail'),
      relatedDataCount > 0 ? tk('main.apps.confirm.related_detail') : null
    ].filter(Boolean)

    const confirm = await dialog.showMessageBox(win ?? undefined, {
      type: 'warning',
      buttons: [tk('window.unsaved.cancel'), actionLabel],
      defaultId: 0,
      cancelId: 0,
      title: target.platform === 'mac' ? tk('main.apps.confirm.move_title') : tk('main.apps.confirm.uninstall_title'),
      message: tk('main.apps.confirm.message', { name: target.name, action: actionLabel }),
      detail: detailLines.join('\n')
    })

    if (confirm.response === 0) {
      const result: AppRemovalResult = {
        id: target.id,
        name: target.name,
        started: false,
        completed: false,
        cancelled: true
      }
      logInfoAction('apps-ipc', 'uninstall.cancel', withRequestMeta(requestMeta, { appId, name: target.name }))
      return success(result)
    }

    try {
      const result = await uninstallInstalledApp({
        appId,
        relatedDataIds
      })
      logInfoAction('apps-ipc', 'uninstall.start', withRequestMeta(requestMeta, {
        appId,
        relatedDataCount,
        completed: result.completed,
        action: result.action
      }))
      return success(result)
    } catch (error) {
      logErrorAction('apps-ipc', 'uninstall.start', withRequestMeta(requestMeta, { appId, error }))
      return failure('UNKNOWN_ERROR', tk('apps.error.uninstall_start'))
    }
  })
}
