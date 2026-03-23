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
import { t } from '../i18n'

export function registerAppsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.APPS_LIST_INSTALLED, async () => {
    try {
      return success(await listInstalledApps())
    } catch (error) {
      logError('apps-ipc', 'Failed to list installed apps', error)
      return failure('UNKNOWN_ERROR', t('설치 앱 목록을 불러오지 못했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_OPEN_LOCATION, async (_event, appId: string) => {
    if (!appId || typeof appId !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 앱 ID입니다.'))
    }

    try {
      await openInstalledAppLocation(appId)
      return success(true)
    } catch (error) {
      logError('apps-ipc', 'Failed to open installed app location', { appId, error })
      return failure('UNKNOWN_ERROR', t('설치 위치를 열지 못했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_OPEN_SYSTEM_SETTINGS, async () => {
    try {
      await openSystemUninstallSettings()
      return success(true)
    } catch (error) {
      logError('apps-ipc', 'Failed to open system uninstall settings', error)
      return failure('UNKNOWN_ERROR', t('시스템 제거 설정을 열지 못했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_GET_RELATED_DATA, async (_event, appId: string) => {
    if (!appId || typeof appId !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 앱 ID입니다.'))
    }

    try {
      return success(await getInstalledAppRelatedData(appId))
    } catch (error) {
      logError('apps-ipc', 'Failed to get related app data', { appId, error })
      return failure('UNKNOWN_ERROR', t('관련 데이터 목록을 불러오지 못했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_LIST_LEFTOVER_DATA, async () => {
    try {
      return success(await listLeftoverAppData())
    } catch (error) {
      logError('apps-ipc', 'Failed to list leftover app data', error)
      return failure('UNKNOWN_ERROR', t('잔여 앱 데이터를 불러오지 못했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_REMOVE_LEFTOVER_DATA, async (_event, itemIds: string[]) => {
    if (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.some((entry) => typeof entry !== 'string' || !entry.trim())) {
      return failure('INVALID_INPUT', t('유효하지 않은 항목 ID 목록입니다.'))
    }

    try {
      return success(await removeLeftoverAppData(itemIds))
    } catch (error) {
      logError('apps-ipc', 'Failed to remove leftover app data', { itemIds, error })
      return failure('UNKNOWN_ERROR', t('잔여 앱 데이터를 휴지통으로 이동하지 못했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_UNINSTALL, async (_event, request: AppUninstallRequest) => {
    const appId = request?.appId
    if (!appId || typeof appId !== 'string') {
      logWarn('apps-ipc', 'App uninstall rejected due to invalid input', { appId })
      return failure('INVALID_INPUT', t('유효하지 않은 앱 ID입니다.'))
    }

    const target = getInstalledAppById(appId)
    if (!target) {
      return failure('UNKNOWN_ERROR', t('설치 앱 정보를 찾을 수 없습니다.'))
    }
    if (target.protected) {
      return failure('PERMISSION_DENIED', target.protectedReason ?? t('보호된 항목은 제거할 수 없습니다.'))
    }

    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const actionLabel = target.platform === 'mac' ? t('Move to Trash') : t('Uninstall')
    const relatedDataIds = Array.isArray(request.relatedDataIds) ? request.relatedDataIds.filter((id) => typeof id === 'string' && id.trim()) : []
    const relatedDataCount = relatedDataIds.length
    const detailLines = [
      target.version ? `Version: ${target.version}` : null,
      target.publisher ? `Publisher: ${target.publisher}` : null,
      target.installLocation ? `Location: ${target.installLocation}` : null,
      relatedDataCount > 0 ? `Related Data: ${relatedDataCount} item(s)` : null,
      '',
      target.platform === 'mac'
        ? t('앱 번들을 휴지통으로 이동합니다.')
        : t('설치된 제거 프로그램을 실행합니다. 진행은 외부 제거기에서 계속됩니다.'),
      relatedDataCount > 0 ? t('선택한 관련 데이터 경로도 함께 휴지통으로 이동합니다.') : null
    ].filter(Boolean)

    const confirm = await dialog.showMessageBox(win ?? undefined, {
      type: 'warning',
      buttons: [t('Cancel'), actionLabel],
      defaultId: 0,
      cancelId: 0,
      title: target.platform === 'mac' ? t('Move App to Trash') : t('Uninstall App'),
      message: t('"{name}"을(를) {action}하시겠습니까?', { name: target.name, action: actionLabel }),
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
      return failure('UNKNOWN_ERROR', error instanceof Error ? error.message : t('앱 제거를 시작하지 못했습니다.'))
    }
  })
}
