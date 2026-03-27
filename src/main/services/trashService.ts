import { dialog, shell, BrowserWindow, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { logError, logInfo } from './logging'
import { isPathInsideParent } from '../ipc/settingsPathUtils'
import type { TrashResult } from '@shared/types'
import { formatBytes } from '@shared/utils/formatBytes'
import { t, tk } from '../i18n'
import { getDirSize } from '../utils/getDirSize'

export async function trashItemsWithConfirm(
  filePaths: string[],
  description: string
): Promise<TrashResult> {
  const homePath = app.getPath('home')

  // 경로 검증: 홈 디렉토리 하위만 허용
  const validPaths: { path: string; size: number }[] = []
  const invalidPaths: string[] = []

  for (const p of filePaths) {
    const resolved = path.resolve(p)

    if (!isPathInsideParent(resolved, homePath)) {
      invalidPaths.push(p)
      continue
    }

    try {
      const stat = await fs.stat(resolved)
      const size = stat.isDirectory()
        ? await getDirSize(resolved)
        : stat.size
      validPaths.push({ path: resolved, size })
    } catch {
      invalidPaths.push(p)
    }
  }

  if (validPaths.length === 0) {
    return { successCount: 0, failCount: filePaths.length, totalSize: 0, trashedPaths: [], errors: [tk('main.trash.error.no_files')], cancelled: false }
  }

  const totalSize = validPaths.reduce((acc, f) => acc + f.size, 0)

  // 확인 다이얼로그
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) {
    return { successCount: 0, failCount: filePaths.length, totalSize: 0, trashedPaths: [], errors: [tk('main.settings.error.no_active_window')], cancelled: false }
  }

  const fileList = validPaths.length <= 5
    ? validPaths.map((f) => `  ${path.basename(f.path)} (${formatBytes(f.size)})`).join('\n')
    : validPaths.slice(0, 4).map((f) => `  ${path.basename(f.path)} (${formatBytes(f.size)})`).join('\n')
      + `\n  ${tk('main.trash.dialog.more', { count: validPaths.length - 4 })}`

  const result = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: [t('Cancel'), tk('main.trash.dialog.title')],
    defaultId: 0,
    cancelId: 0,
    title: tk('main.trash.dialog.title'),
    message: `${description}`,
    detail: tk('main.trash.dialog.detail', {
      count: validPaths.length,
      size: formatBytes(totalSize),
      fileList
    })
  })

  if (result.response === 0) {
    return { successCount: 0, failCount: 0, totalSize: 0, trashedPaths: [], errors: [], cancelled: true }
  }

  // 휴지통으로 이동
  let successCount = 0
  let trashedSize = 0
  const trashedPaths: string[] = []
  const errors: string[] = []

  for (const file of validPaths) {
    try {
      await shell.trashItem(file.path)
      successCount++
      trashedSize += file.size
      trashedPaths.push(file.path)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${path.basename(file.path)}: ${msg}`)
      logError('trash', 'Failed to move item to trash', { path: file.path, error: err })
    }
  }

  logInfo('trash', 'Trash operation completed', {
    successCount,
    requestedCount: validPaths.length,
    trashedSize,
    trashedSizeLabel: formatBytes(trashedSize)
  })

  return {
    successCount,
    failCount: validPaths.length - successCount + invalidPaths.length,
    totalSize: trashedSize,
    trashedPaths,
    errors,
    cancelled: false
  }
}
