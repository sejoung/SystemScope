import { ipcMain, BrowserWindow, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { failure, success } from '@shared/types'
import type { AppRemovalResult } from '@shared/types'
import {
  getInstalledAppById,
  listInstalledApps,
  openInstalledAppLocation,
  openSystemUninstallSettings,
  uninstallInstalledApp
} from '../services/installedApps'
import { logError, logInfo, logWarn } from '../services/logging'

export function registerAppsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.APPS_LIST_INSTALLED, async () => {
    try {
      return success(await listInstalledApps())
    } catch (error) {
      logError('apps-ipc', 'Failed to list installed apps', error)
      return failure('UNKNOWN_ERROR', '설치 앱 목록을 불러오지 못했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_OPEN_LOCATION, async (_event, appId: string) => {
    if (!appId || typeof appId !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 앱 ID입니다.')
    }

    try {
      await openInstalledAppLocation(appId)
      return success(true)
    } catch (error) {
      logError('apps-ipc', 'Failed to open installed app location', { appId, error })
      return failure('UNKNOWN_ERROR', '설치 위치를 열지 못했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_OPEN_SYSTEM_SETTINGS, async () => {
    try {
      await openSystemUninstallSettings()
      return success(true)
    } catch (error) {
      logError('apps-ipc', 'Failed to open system uninstall settings', error)
      return failure('UNKNOWN_ERROR', '시스템 제거 설정을 열지 못했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.APPS_UNINSTALL, async (_event, appId: string) => {
    if (!appId || typeof appId !== 'string') {
      logWarn('apps-ipc', 'App uninstall rejected due to invalid input', { appId })
      return failure('INVALID_INPUT', '유효하지 않은 앱 ID입니다.')
    }

    const target = getInstalledAppById(appId)
    if (!target) {
      return failure('UNKNOWN_ERROR', '설치 앱 정보를 찾을 수 없습니다.')
    }
    if (target.protected) {
      return failure('PERMISSION_DENIED', target.protectedReason ?? '보호된 항목은 제거할 수 없습니다.')
    }

    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const actionLabel = target.platform === 'mac' ? '휴지통으로 이동' : '제거 프로그램 실행'
    const detailLines = [
      target.version ? `Version: ${target.version}` : null,
      target.publisher ? `Publisher: ${target.publisher}` : null,
      target.installLocation ? `Location: ${target.installLocation}` : null,
      '',
      target.platform === 'mac'
        ? '앱 번들을 휴지통으로 이동합니다.'
        : '설치된 제거 프로그램을 실행합니다. 진행은 외부 제거기에서 계속됩니다.'
    ].filter(Boolean)

    const confirm = await dialog.showMessageBox(win ?? undefined, {
      type: 'warning',
      buttons: ['Cancel', actionLabel],
      defaultId: 0,
      cancelId: 0,
      title: target.platform === 'mac' ? 'Move App to Trash' : 'Uninstall App',
      message: `"${target.name}"을(를) ${actionLabel}하시겠습니까?`,
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
      const result = await uninstallInstalledApp(appId)
      return success(result)
    } catch (error) {
      logError('apps-ipc', 'Failed to uninstall app', { appId, error })
      return failure('UNKNOWN_ERROR', error instanceof Error ? error.message : '앱 제거를 시작하지 못했습니다.')
    }
  })
}
