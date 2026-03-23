import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { tmpdir } from 'os'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getSettings, setSettings } from '../store/settingsStore'
import { validatePartialSettings } from '../store/settingsSchema'
import { success, failure } from '@shared/types'
import { restartSnapshotScheduler } from '../services/growthAnalyzer'
import { setThresholds } from '../services/alertManager'
import { didShellOpenPathFail, isPathInsideAnyParent, isPathInsideParent } from './settingsPathUtils'
import { getLogDir, logError, logWarn } from '../services/logging'
import { tk } from '../i18n'

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return success(getSettings())
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, settings: Record<string, unknown>) => {
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

      return success(getSettings())
    } catch (err) {
      logError('settings-ipc', 'Failed to save settings', err)
      return failure('UNKNOWN_ERROR', tk('main.settings.error.save_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_DATA_PATH, () => {
    return success(app.getPath('userData'))
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_LOG_PATH, () => {
    return success(getLogDir())
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) {
      return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
    }
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return success(null)
    }
    return success(result.filePaths[0])
  })

  // Shell: 폴더를 Finder / Explorer에서 직접 열기
  // 가이드라인 6.3: 앱이 관리하는 경로(userData)만 허용
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (_event, targetPath: string) => {
    if (!targetPath || typeof targetPath !== 'string') {
      return failure('INVALID_INPUT', tk('main.settings.error.invalid_path'))
    }

    const resolved = path.resolve(targetPath)
    const userData = app.getPath('userData')

    if (!isPathInsideParent(resolved, userData)) {
      return failure('PERMISSION_DENIED', tk('main.settings.error.permission_denied'))
    }

    if (!fs.existsSync(resolved)) {
      return failure('INVALID_INPUT', tk('main.settings.error.path_missing'))
    }

    try {
      const openResult = await shell.openPath(resolved)
      if (didShellOpenPathFail(openResult)) {
        logError('settings-ipc', 'Failed to open path', { path: resolved, error: openResult })
        return failure('UNKNOWN_ERROR', tk('main.settings.error.open_folder'))
      }
      return success(true)
    } catch (err) {
      logError('settings-ipc', 'Failed to open path', { path: resolved, error: err })
      return failure('UNKNOWN_ERROR', tk('main.settings.error.open_folder'))
    }
  })

  // Shell: Finder / Explorer에서 파일/폴더 위치 열기
  // 가이드라인 6.3: 신뢰되지 않은 경로를 검증 없이 열지 않는다
  // 허용 범위: 앱이 탐색하거나 관리하는 사용자 영역 경로
  ipcMain.handle(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, (_event, targetPath: string) => {
    if (!targetPath || typeof targetPath !== 'string') {
      return failure('INVALID_INPUT', tk('main.settings.error.invalid_path'))
    }

    const resolved = path.resolve(targetPath)
    const windowsSystemRoots = process.platform === 'win32'
      ? [
          tmpdir(),
          process.env.SystemRoot ? path.join(process.env.SystemRoot, 'SoftwareDistribution') : undefined,
          process.env.SystemDrive ? path.join(process.env.SystemDrive, '$Recycle.Bin') : undefined
        ]
      : []
    const allowedRoots = [
      app.getPath('home'),
      app.getPath('userData'),
      process.env.APPDATA,
      process.env.LOCALAPPDATA,
      process.env.ProgramData,
      ...windowsSystemRoots
    ]

    if (!isPathInsideAnyParent(resolved, allowedRoots)) {
      logWarn('settings-ipc', 'Blocked showInFolder because path is outside allowed roots', { path: resolved })
      return failure('PERMISSION_DENIED', tk('main.settings.error.permission_denied'))
    }

    if (!fs.existsSync(resolved)) {
      return failure('INVALID_INPUT', tk('main.settings.error.path_missing'))
    }

    try {
      shell.showItemInFolder(resolved)
      return success(true)
    } catch (err) {
      logError('settings-ipc', 'Failed to show item in folder', { path: resolved, error: err })
      return failure('UNKNOWN_ERROR', tk('main.settings.error.open_folder'))
    }
  })

}
