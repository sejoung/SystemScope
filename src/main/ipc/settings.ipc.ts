import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getSettings, setSettings } from '../store/settingsStore'
import { validatePartialSettings } from '../store/settingsSchema'
import { success, failure } from '@shared/types'
import { restartSnapshotScheduler } from '../services/growthAnalyzer'
import { setThresholds } from '../services/alertManager'
import { didShellOpenPathFail, isPathInsideParent } from './settingsPathUtils'
import { getAccessLogDir, getSystemLogDir, logErrorAction, logInfoAction, logWarnAction } from '../services/logging'
import { tk } from '../i18n'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'
import { isShellPathRegistered, registerShellPath } from '../services/shellPathRegistry'
import { recordEvent } from '../services/eventStore'

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    const settings = getSettings()
    logInfoAction('settings-ipc', 'settings.get', withRequestMeta(requestMeta))
    return success(settings)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, settings: Record<string, unknown>, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!validatePartialSettings(settings)) {
      return failure('INVALID_INPUT', tk('main.settings.error.invalid_value'))
    }
    try {
      const parsed = settings as Parameters<typeof setSettings>[0]
      setSettings(parsed)
      if (parsed.thresholds) {
        setThresholds(parsed.thresholds)
      }

      // 스냅샷 주기 변경 시 스케줄러 재시작
      if (parsed.snapshotIntervalMin) {
        restartSnapshotScheduler(parsed.snapshotIntervalMin * 60 * 1000)
      }

      const nextSettings = getSettings()
      void recordEvent('settings_change', 'info', 'Settings updated', undefined, {
        updatedKeys: Object.keys(parsed)
      })
      logInfoAction('settings-ipc', 'settings.save', withRequestMeta(requestMeta, {
        updatedKeys: Object.keys(parsed),
        thresholdsUpdated: Boolean(parsed.thresholds),
        snapshotIntervalMin: parsed.snapshotIntervalMin
      }))
      return success(nextSettings)
    } catch (err) {
      logErrorAction('settings-ipc', 'settings.save', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.settings.error.save_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_DATA_PATH, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    const dataPath = app.getPath('userData')
    registerShellPath(dataPath)
    logInfoAction('settings-ipc', 'paths.user_data.get', withRequestMeta(requestMeta, { path: dataPath }))
    return success(dataPath)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_SYSTEM_LOG_PATH, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    const logPath = getSystemLogDir()
    registerShellPath(logPath)
    logInfoAction('settings-ipc', 'paths.system_log.get', withRequestMeta(requestMeta, { path: logPath }))
    return success(logPath)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ACCESS_LOG_PATH, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    const logPath = getAccessLogDir()
    registerShellPath(logPath)
    logInfoAction('settings-ipc', 'paths.access_log.get', withRequestMeta(requestMeta, { path: logPath }))
    return success(logPath)
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) {
      return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
    }
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      logInfoAction('settings-ipc', 'dialog.select_folder.cancel', withRequestMeta(requestMeta))
      return success(null)
    }
    logInfoAction('settings-ipc', 'dialog.select_folder.complete', withRequestMeta(requestMeta, { path: result.filePaths[0] }))
    registerShellPath(result.filePaths[0])
    return success(result.filePaths[0])
  })

  // Shell: 폴더를 Finder / Explorer에서 직접 열기
  // 가이드라인 6.3: 앱이 관리하는 경로(userData)만 허용
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (_event, targetPath: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!targetPath || typeof targetPath !== 'string') {
      return failure('INVALID_INPUT', tk('main.settings.error.invalid_path'))
    }

    const resolved = path.resolve(targetPath)
    const userData = app.getPath('userData')

    // SECURITY: openPath는 userData 내부 + 등록된 경로만 허용 (이중 검증).
    // showInFolder는 registry만 확인 — openPath가 더 위험한 작업이므로 의도적으로 더 엄격.
    if (!isPathInsideParent(resolved, userData) || !isShellPathRegistered(resolved)) {
      return failure('PERMISSION_DENIED', tk('main.settings.error.permission_denied'))
    }

    if (!fs.existsSync(resolved)) {
      return failure('INVALID_INPUT', tk('main.settings.error.path_missing'))
    }

    try {
      const openResult = await shell.openPath(resolved)
      if (didShellOpenPathFail(openResult)) {
        logErrorAction('settings-ipc', 'path.open', withRequestMeta(requestMeta, { path: resolved, error: openResult }))
        return failure('UNKNOWN_ERROR', tk('main.settings.error.open_folder'))
      }
      logInfoAction('settings-ipc', 'path.open', withRequestMeta(requestMeta, { path: resolved }))
      return success(true)
    } catch (err) {
      logErrorAction('settings-ipc', 'path.open', withRequestMeta(requestMeta, { path: resolved, error: err }))
      return failure('UNKNOWN_ERROR', tk('main.settings.error.open_folder'))
    }
  })

  // Shell: Finder / Explorer에서 파일/폴더 위치 열기
  // 가이드라인 6.3: 신뢰되지 않은 경로를 검증 없이 열지 않는다
  // 허용 범위: 앱이 탐색하거나 관리하는 사용자 영역 경로
  ipcMain.handle(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, (_event, targetPath: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!targetPath || typeof targetPath !== 'string') {
      return failure('INVALID_INPUT', tk('main.settings.error.invalid_path'))
    }

    const resolved = path.resolve(targetPath)
    if (!isShellPathRegistered(resolved)) {
      logWarnAction('settings-ipc', 'path.reveal', withRequestMeta(requestMeta, { reason: 'path_not_registered', path: resolved }))
      return failure('PERMISSION_DENIED', tk('main.settings.error.permission_denied'))
    }

    if (!fs.existsSync(resolved)) {
      return failure('INVALID_INPUT', tk('main.settings.error.path_missing'))
    }

    try {
      shell.showItemInFolder(resolved)
      logInfoAction('settings-ipc', 'path.reveal', withRequestMeta(requestMeta, { path: resolved }))
      return success(true)
    } catch (err) {
      logErrorAction('settings-ipc', 'path.reveal', withRequestMeta(requestMeta, { path: resolved, error: err }))
      return failure('UNKNOWN_ERROR', tk('main.settings.error.open_folder'))
    }
  })

}
