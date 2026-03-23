import { ipcMain, BrowserWindow, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { failure, success } from '@shared/types'
import type { AppRemovalResult, AppUninstallRequest } from '@shared/types'
import {
  getInstalledAppById,
  getInstalledAppRelatedData,
  listInstalledApps,
  listLeftoverAppData,
  openInstalledAppLocation,
  removeLeftoverAppData,
  openSystemUninstallSettings,
  uninstallInstalledApp
} from '../services/installedApps'
import { logError, logInfo, logWarn } from '../services/logging'
import { tk } from '../i18n'

export function registerAppsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.APPS_LIST_INSTALLED, async () => {
    try {
      return success(await listInstalledApps())
    } catch (error) {
      logError('apps-ipc', 'Failed to list installed apps', error)
      return failure('UNKNOWN_ERROR', tk('apps.error.load_installed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_OPEN_LOCATION, async (_event, appId: string) => {
    if (!appId || typeof appId !== 'string') {
      return failure('INVALID_INPUT', 'Invalid app ID.')
    }

    try {
      await openInstalledAppLocation(appId)
      return success(true)
    } catch (error) {
      logError('apps-ipc', 'Failed to open installed app location', { appId, error })
      return failure('UNKNOWN_ERROR', tk('apps.error.open_location'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_OPEN_SYSTEM_SETTINGS, async () => {
    try {
      await openSystemUninstallSettings()
      return success(true)
    } catch (error) {
      logError('apps-ipc', 'Failed to open system uninstall settings', error)
      return failure('UNKNOWN_ERROR', tk('apps.error.open_system_settings'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_GET_RELATED_DATA, async (_event, appId: string) => {
    if (!appId || typeof appId !== 'string') {
      return failure('INVALID_INPUT', 'Invalid app ID.')
    }

    try {
      return success(await getInstalledAppRelatedData(appId))
    } catch (error) {
      logError('apps-ipc', 'Failed to get related app data', { appId, error })
      return failure('UNKNOWN_ERROR', tk('apps.error.load_related'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_LIST_LEFTOVER_DATA, async () => {
    try {
      return success(await listLeftoverAppData())
    } catch (error) {
      logError('apps-ipc', 'Failed to list leftover app data', error)
      return failure('UNKNOWN_ERROR', tk('apps.error.load_leftover'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_REMOVE_LEFTOVER_DATA, async (_event, itemIds: string[]) => {
    if (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.some((entry) => typeof entry !== 'string' || !entry.trim())) {
      return failure('INVALID_INPUT', 'Invalid item ID list.')
    }

    try {
      return success(await removeLeftoverAppData(itemIds))
    } catch (error) {
      logError('apps-ipc', 'Failed to remove leftover app data', { itemIds, error })
      return failure('UNKNOWN_ERROR', tk('apps.error.remove_leftover'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_UNINSTALL, async (_event, request: AppUninstallRequest) => {
    const appId = request?.appId
    if (!appId || typeof appId !== 'string') {
      logWarn('apps-ipc', 'App uninstall rejected due to invalid input', { appId })
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
      target.version ? `Version: ${target.version}` : null,
      target.publisher ? `Publisher: ${target.publisher}` : null,
      target.installLocation ? `Location: ${target.installLocation}` : null,
      relatedDataCount > 0 ? `Related Data: ${relatedDataCount} item(s)` : null,
      '',
      target.platform === 'mac'
        ? tk('main.apps.confirm.move_detail')
        : tk('main.apps.confirm.uninstall_detail'),
      relatedDataCount > 0 ? tk('main.apps.confirm.related_detail') : null
    ].filter(Boolean)

    const confirm = await dialog.showMessageBox(win ?? undefined, {
      type: 'warning',
      buttons: ['Cancel', actionLabel],
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
      logInfo('apps-ipc', 'App uninstall cancelled by user', { appId, name: target.name })
      return success(result)
    }

    try {
      const result = await uninstallInstalledApp({
        appId,
        relatedDataIds
      })
      return success(result)
    } catch (error) {
      logError('apps-ipc', 'Failed to uninstall app', { appId, error })
      return failure('UNKNOWN_ERROR', error instanceof Error ? error.message : tk('apps.error.uninstall_start'))
    }
  })
}
