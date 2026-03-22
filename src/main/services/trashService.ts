import { dialog, shell, BrowserWindow, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { logError, logInfo } from './logging'
import { isPathInsideParent } from '../ipc/settingsPathUtils'
import type { TrashResult } from '@shared/types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

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
      const stat = fs.statSync(resolved)
      validPaths.push({ path: resolved, size: stat.size })
    } catch {
      invalidPaths.push(p)
    }
  }

  if (validPaths.length === 0) {
    return { successCount: 0, failCount: filePaths.length, totalSize: 0, trashedPaths: [], errors: ['삭제할 수 있는 파일이 없습니다.'] }
  }

  const totalSize = validPaths.reduce((acc, f) => acc + f.size, 0)

  // 확인 다이얼로그
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const fileList = validPaths.length <= 5
    ? validPaths.map((f) => `  ${path.basename(f.path)} (${formatBytes(f.size)})`).join('\n')
    : validPaths.slice(0, 4).map((f) => `  ${path.basename(f.path)} (${formatBytes(f.size)})`).join('\n')
      + `\n  ... 외 ${validPaths.length - 4}개`

  const result = await dialog.showMessageBox(win!, {
    type: 'warning',
    buttons: ['Cancel', 'Move to Trash'],
    defaultId: 0,
    cancelId: 0,
    title: 'Move to Trash',
    message: `${description}`,
    detail: `${validPaths.length}개 항목 (${formatBytes(totalSize)})을 휴지통으로 이동하시겠습니까?\n\n${fileList}\n\n휴지통에서 복구할 수 있습니다.`
  })

  if (result.response === 0) {
    return { successCount: 0, failCount: 0, totalSize: 0, trashedPaths: [], errors: [] }
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
      logError('trash', 'Failed to trash item', { path: file.path, error: err })
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
    errors
  }
}
