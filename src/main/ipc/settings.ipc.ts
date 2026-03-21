import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getSettings, setSettings } from '../store/settingsStore'
import { success, failure } from '@shared/types'
import log from 'electron-log'

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return success(getSettings())
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, settings: Record<string, unknown>) => {
    if (!settings || typeof settings !== 'object') {
      return failure('INVALID_INPUT', '유효하지 않은 설정 값입니다.')
    }
    setSettings(settings as Parameters<typeof setSettings>[0])
    return success(getSettings())
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

  // Shell: Finder / Explorer에서 폴더 열기
  // 가이드라인 6.3: 신뢰되지 않은 경로를 검증 없이 열지 않는다
  ipcMain.handle(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, (_event, targetPath: string) => {
    if (!targetPath || typeof targetPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }

    // Resolve to absolute path to prevent traversal
    const resolved = path.resolve(targetPath)

    // Verify the path actually exists
    if (!fs.existsSync(resolved)) {
      return failure('INVALID_INPUT', '경로가 존재하지 않습니다.')
    }

    try {
      shell.showItemInFolder(resolved)
      return success(true)
    } catch (err) {
      log.error('Failed to show in folder', { path: resolved, error: err })
      return failure('UNKNOWN_ERROR', '폴더를 열 수 없습니다.')
    }
  })
}
