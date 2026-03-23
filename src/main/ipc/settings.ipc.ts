import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getSettings, setSettings } from '../store/settingsStore'
import { validatePartialSettings } from '../store/settingsSchema'
import { success, failure } from '@shared/types'
import { restartSnapshotScheduler } from '../services/growthAnalyzer'
import { setThresholds } from '../services/alertManager'
import { didShellOpenPathFail, isPathInsideParent } from './settingsPathUtils'
import { getLogDir, logError, logWarn } from '../services/logging'

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return success(getSettings())
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, settings: Record<string, unknown>) => {
    if (!validatePartialSettings(settings)) {
      return failure('INVALID_INPUT', '유효하지 않은 설정 값입니다.')
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
      logError('settings-ipc', '설정 저장 실패', err)
      return failure('UNKNOWN_ERROR', '설정 저장에 실패했습니다.')
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
      return failure('UNKNOWN_ERROR', '활성 창을 찾을 수 없습니다.')
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
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }

    const resolved = path.resolve(targetPath)
    const userData = app.getPath('userData')

    if (!isPathInsideParent(resolved, userData)) {
      return failure('PERMISSION_DENIED', '허용되지 않은 경로입니다.')
    }

    if (!fs.existsSync(resolved)) {
      return failure('INVALID_INPUT', '경로가 존재하지 않습니다.')
    }

    try {
      const openResult = await shell.openPath(resolved)
      if (didShellOpenPathFail(openResult)) {
        logError('settings-ipc', '경로 열기 실패', { path: resolved, error: openResult })
        return failure('UNKNOWN_ERROR', '폴더를 열 수 없습니다.')
      }
      return success(true)
    } catch (err) {
      logError('settings-ipc', '경로 열기 실패', { path: resolved, error: err })
      return failure('UNKNOWN_ERROR', '폴더를 열 수 없습니다.')
    }
  })

  // Shell: Finder / Explorer에서 파일/폴더 위치 열기
  // 가이드라인 6.3: 신뢰되지 않은 경로를 검증 없이 열지 않는다
  // 허용 범위: 사용자 홈 디렉토리 이하 (스캔 결과, Quick Scan 등 앱이 탐색한 경로)
  ipcMain.handle(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, (_event, targetPath: string) => {
    if (!targetPath || typeof targetPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }

    const resolved = path.resolve(targetPath)
    const homePath = app.getPath('home')

    // 사용자 홈 디렉토리 하위만 허용
    if (!isPathInsideParent(resolved, homePath)) {
      logWarn('settings-ipc', '홈 디렉토리 외부 경로로 폴더 열기 차단', { path: resolved })
      return failure('PERMISSION_DENIED', '허용되지 않은 경로입니다.')
    }

    if (!fs.existsSync(resolved)) {
      return failure('INVALID_INPUT', '경로가 존재하지 않습니다.')
    }

    try {
      shell.showItemInFolder(resolved)
      return success(true)
    } catch (err) {
      logError('settings-ipc', '폴더에서 보기 실패', { path: resolved, error: err })
      return failure('UNKNOWN_ERROR', '폴더를 열 수 없습니다.')
    }
  })

}
