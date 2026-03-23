import { ipcMain, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { randomUUID } from 'crypto'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { MAX_TRASH_TARGETS } from '@shared/constants/thresholds'
import { scanFolder, findLargeFiles, getExtensionBreakdown } from '../services/diskAnalyzer'
import { runQuickScan } from '../services/quickScan'
import { getUserSpaceInfo } from '../services/userSpace'
import { findRecentGrowth, findDuplicates } from '../services/diskInsights'
import { analyzeGrowth } from '../services/growthAnalyzer'
import { findOldFiles } from '../services/oldFileFinder'
import { createJob, cancelJob, sendJobProgress, sendJobCompleted, sendJobFailed } from '../jobs/jobManager'
import { success, failure } from '@shared/types'
import type { DiskScanResult, DuplicateGroup, LargeFile, TrashItemsRequest } from '@shared/types'
import { logError } from '../services/logging'
import { trashItemsWithConfirm } from '../services/trashService'
import { t } from '../i18n'

// 대용량 파일 / 확장자 조회를 위한 마지막 스캔 결과 캐시
let lastScanResult: DiskScanResult | null = null
const registeredTrashTargets = new Map<string, { path: string; rootPath: string; scope: 'large' | 'old' | 'duplicate' }>()

export function registerDiskIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DISK_SCAN_FOLDER, async (_event, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 경로입니다.'))
    }

    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', t('폴더에 접근할 수 없습니다.'))
    }

    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      return failure('UNKNOWN_ERROR', t('활성 창을 찾을 수 없습니다.'))
    }

    const job = createJob('diskScan')
    job.status = 'running'

    // 스캔을 비동기로 실행하고 작업 ID를 즉시 반환
    scanFolder(
      resolved,
      (current, fileCount) => {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          sendJobProgress(win, job, -1, t('스캔 중: {name} ({count}개 파일)', { name: path.basename(current), count: fileCount }))
        }
      },
      job.abortController.signal
    )
      .then((result) => {
        lastScanResult = result
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          sendJobCompleted(win, job, result)
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.message === 'Scan cancelled') {
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            sendJobFailed(win, job, t('스캔이 취소되었습니다.'))
          }
        } else {
          logError('disk-ipc', 'Disk scan failed', err)
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            sendJobFailed(win, job, t('디스크 스캔 중 오류가 발생했습니다.'))
          }
        }
      })

    return success({ jobId: job.id })
  })

  ipcMain.handle(IPC_CHANNELS.DISK_INVALIDATE_SCAN_CACHE, (_event, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 경로입니다.'))
    }

    const resolved = path.resolve(folderPath)
    if (lastScanResult && path.resolve(lastScanResult.rootPath) === resolved) {
      lastScanResult = null
    }
    clearTrashTargetsForRootPath(resolved)

    return success(true)
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GET_LARGE_FILES, async (_event, folderPath: string, limit: number) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 경로입니다.'))
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      return failure('INVALID_INPUT', t('유효하지 않은 limit 값입니다.'))
    }

    const resolved = path.resolve(folderPath)

    // 해당 경로의 캐시된 결과가 있으면 사용
    if (lastScanResult && path.resolve(lastScanResult.rootPath) === resolved) {
      return success(registerLargeFileTrashTargets(findLargeFiles(lastScanResult.tree, limit), resolved, 'large'))
    }
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', t('폴더에 접근할 수 없습니다.'))
    }

    try {
      const result = await scanFolder(resolved)
      lastScanResult = result
      return success(registerLargeFileTrashTargets(findLargeFiles(result.tree, limit), resolved, 'large'))
    } catch (err) {
      logError('disk-ipc', 'Large file scan failed', err)
      return failure('SCAN_FAILED', t('대용량 파일 탐색에 실패했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GET_EXTENSIONS, async (_event, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 경로입니다.'))
    }

    const resolved = path.resolve(folderPath)
    if (lastScanResult && path.resolve(lastScanResult.rootPath) === resolved) {
      return success(getExtensionBreakdown(lastScanResult.tree))
    }
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', t('폴더에 접근할 수 없습니다.'))
    }

    try {
      const result = await scanFolder(resolved)
      lastScanResult = result
      return success(getExtensionBreakdown(result.tree))
    } catch (err) {
      logError('disk-ipc', 'Extension analysis failed', err)
      return failure('SCAN_FAILED', t('확장자 분석에 실패했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_QUICK_SCAN, async () => {
    try {
      const results = await runQuickScan()
      return success(results)
    } catch (err) {
      logError('disk-ipc', 'Quick scan failed', err)
      return failure('SCAN_FAILED', t('빠른 스캔에 실패했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_USER_SPACE, async () => {
    try {
      const info = await getUserSpaceInfo()
      return success(info)
    } catch (err) {
      logError('disk-ipc', 'User-space scan failed', err)
      return failure('SCAN_FAILED', t('사용자 공간 분석에 실패했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_RECENT_GROWTH, async (_event, folderPath: string, days: number = 7) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 경로입니다.'))
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return failure('INVALID_INPUT', t('유효하지 않은 기간입니다. (1~365일)'))
    }
    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', t('폴더에 접근할 수 없습니다.'))
    }
    try {
      const results = await findRecentGrowth(resolved, days)
      return success(results)
    } catch (err) {
      logError('disk-ipc', 'Recent growth scan failed', err)
      return failure('SCAN_FAILED', t('최근 변경 분석에 실패했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_FIND_DUPLICATES, async (_event, folderPath: string, minSizeKB: number = 100) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 경로입니다.'))
    }
    if (!Number.isInteger(minSizeKB) || minSizeKB < 1 || minSizeKB > 1048576) {
      return failure('INVALID_INPUT', t('유효하지 않은 최소 크기입니다. (1KB~1GB)'))
    }
    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', t('폴더에 접근할 수 없습니다.'))
    }
    try {
      const results = registerDuplicateTrashTargets(await findDuplicates(resolved, minSizeKB * 1024), resolved)
      return success(results)
    } catch (err) {
      logError('disk-ipc', 'Duplicate file scan failed', err)
      return failure('SCAN_FAILED', t('중복 파일 탐색에 실패했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GROWTH_VIEW, async (_event, period: string = '7d') => {
    if (!['1h', '24h', '7d'].includes(period)) {
      return failure('INVALID_INPUT', t('유효하지 않은 기간입니다. (1h, 24h, 7d)'))
    }
    try {
      const result = await analyzeGrowth(period)
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Growth analysis failed', err)
      return failure('SCAN_FAILED', t('성장 분석에 실패했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_FIND_OLD_FILES, async (_event, folderPath: string, olderThanDays: number = 365) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 경로입니다.'))
    }
    if (!Number.isInteger(olderThanDays) || olderThanDays < 1 || olderThanDays > 3650) {
      return failure('INVALID_INPUT', t('유효하지 않은 기간입니다. (1~3650일)'))
    }
    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', t('폴더에 접근할 수 없습니다.'))
    }
    try {
      const results = registerLargeFileTrashTargets(await findOldFiles(resolved, olderThanDays), resolved, 'old')
      return success(results)
    } catch (err) {
      logError('disk-ipc', 'Old file scan failed', err)
      return failure('SCAN_FAILED', t('오래된 파일 탐색에 실패했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_TRASH_ITEMS, async (_event, request: TrashItemsRequest) => {
    if (
      !request ||
      typeof request !== 'object' ||
      !Array.isArray(request.itemIds) ||
      request.itemIds.length === 0 ||
      request.itemIds.some((itemId) => typeof itemId !== 'string' || !itemId.trim())
    ) {
      return failure('INVALID_INPUT', t('유효하지 않은 삭제 요청입니다.'))
    }

    const uniqueIds = [...new Set(request.itemIds)]
    const targets = uniqueIds.map((itemId) => registeredTrashTargets.get(itemId))

    if (targets.some((target) => !target)) {
      return failure('INVALID_INPUT', t('현재 스캔 결과에 없는 항목은 삭제할 수 없습니다.'))
    }
    const resolvedTargets = targets.filter((target): target is { path: string; rootPath: string; scope: 'large' | 'old' | 'duplicate' } => Boolean(target))

    try {
      const result = await trashItemsWithConfirm(
        resolvedTargets.map((target) => target.path),
        request.description || t('파일 삭제')
      )

      if (result.trashedPaths.length > 0) {
        const trashedPathSet = new Set(result.trashedPaths.map((targetPath) => path.resolve(targetPath)))
        for (const [itemId, target] of registeredTrashTargets) {
          if (trashedPathSet.has(path.resolve(target.path))) {
            registeredTrashTargets.delete(itemId)
          }
        }
      }

      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Failed to trash disk items', err)
      return failure('UNKNOWN_ERROR', t('파일 삭제에 실패했습니다.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.JOB_CANCEL, (_event, jobId: string) => {
    if (!jobId || typeof jobId !== 'string') {
      return failure('INVALID_INPUT', t('유효하지 않은 작업 ID입니다.'))
    }
    const cancelled = cancelJob(jobId)
    if (!cancelled) {
      return failure('JOB_NOT_FOUND', t('취소할 수 있는 작업을 찾을 수 없습니다.'))
    }
    return success(true)
  })
}

function clearTrashTargetsForScope(rootPath: string, scope: 'large' | 'old' | 'duplicate'): void {
  for (const [itemId, target] of registeredTrashTargets) {
    if (target.rootPath === rootPath && target.scope === scope) {
      registeredTrashTargets.delete(itemId)
    }
  }
}

function clearTrashTargetsForRootPath(rootPath: string): void {
  for (const [itemId, target] of registeredTrashTargets) {
    if (target.rootPath === rootPath) {
      registeredTrashTargets.delete(itemId)
    }
  }
}

/** 최대 등록 수 초과 시 가장 오래된 항목 제거 */
function enforceTrashTargetLimit(): void {
  while (registeredTrashTargets.size > MAX_TRASH_TARGETS) {
    const firstKey = registeredTrashTargets.keys().next().value
    if (firstKey !== undefined) registeredTrashTargets.delete(firstKey)
    else break
  }
}

function registerLargeFileTrashTargets(
  files: LargeFile[],
  rootPath: string,
  scope: 'large' | 'old'
): LargeFile[] {
  clearTrashTargetsForScope(rootPath, scope)
  const result = files.map((file) => {
    const deletionKey = randomUUID()
    registeredTrashTargets.set(deletionKey, { path: file.path, rootPath, scope })
    return { ...file, deletionKey }
  })
  enforceTrashTargetLimit()
  return result
}

function registerDuplicateTrashTargets(groups: DuplicateGroup[], rootPath: string): DuplicateGroup[] {
  clearTrashTargetsForScope(rootPath, 'duplicate')
  const result = groups.map((group) => ({
    ...group,
    files: group.files.map((file) => {
      const deletionKey = randomUUID()
      registeredTrashTargets.set(deletionKey, { path: file.path, rootPath, scope: 'duplicate' })
      return { ...file, deletionKey }
    })
  }))
  enforceTrashTargetLimit()
  return result
}
