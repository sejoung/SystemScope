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
import { logErrorAction, logInfoAction } from '../services/logging'
import { trashItemsWithConfirm } from '../services/trashService'
import { tk } from '../i18n'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

// 대용량 파일 / 확장자 조회를 위한 마지막 스캔 결과 캐시
let lastScanResult: DiskScanResult | null = null
const registeredTrashTargets = new Map<string, { path: string; rootPath: string; scope: 'large' | 'old' | 'duplicate' }>()

export function registerDiskIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DISK_SCAN_FOLDER, async (_event, folderPath: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_path'))
    }

    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', tk('disk.error.access_denied'))
    }

    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      return failure('UNKNOWN_ERROR', tk('disk.error.no_active_window'))
    }

    const job = createJob('diskScan')
    job.status = 'running'
    logInfoAction('disk-ipc', 'scan.start', withRequestMeta(requestMeta, { jobId: job.id, path: resolved }))

    // 스캔을 비동기로 실행하고 작업 ID를 즉시 반환
    scanFolder(
      resolved,
      (current, fileCount) => {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          sendJobProgress(win, job, -1, tk('disk.scan.progress', { name: path.basename(current), count: fileCount }))
        }
      },
      job.abortController.signal
    )
      .then((result) => {
        lastScanResult = result
        logInfoAction('disk-ipc', 'scan.complete', withRequestMeta(requestMeta, {
          jobId: job.id,
          path: resolved,
          totalSize: result.totalSize
        }))
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          sendJobCompleted(win, job, result)
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.message === 'Scan cancelled') {
          logInfoAction('disk-ipc', 'scan.cancel', withRequestMeta(requestMeta, { jobId: job.id, path: resolved }))
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            sendJobFailed(win, job, tk('disk.scan.cancelled'))
          }
        } else {
          logErrorAction('disk-ipc', 'scan.run', withRequestMeta(requestMeta, { error: err }))
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            sendJobFailed(win, job, tk('disk.scan.failed_runtime'))
          }
        }
      })

    return success({ jobId: job.id })
  })

  ipcMain.handle(IPC_CHANNELS.DISK_INVALIDATE_SCAN_CACHE, (_event, folderPath: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_path'))
    }

    const resolved = path.resolve(folderPath)
    if (lastScanResult && path.resolve(lastScanResult.rootPath) === resolved) {
      lastScanResult = null
    }
    clearTrashTargetsForRootPath(resolved)
    logInfoAction('disk-ipc', 'scan_cache.invalidate', withRequestMeta(requestMeta, { path: resolved }))

    return success(true)
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GET_LARGE_FILES, async (_event, folderPath: string, limit: number, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_path'))
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_limit'))
    }

    const resolved = path.resolve(folderPath)

    // 해당 경로의 캐시된 결과가 있으면 사용
    if (lastScanResult && path.resolve(lastScanResult.rootPath) === resolved) {
      const files = registerLargeFileTrashTargets(findLargeFiles(lastScanResult.tree, limit), resolved, 'large')
      logInfoAction('disk-ipc', 'large_files.list_cached', withRequestMeta(requestMeta, { path: resolved, limit, count: files.length }))
      return success(files)
    }
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', tk('disk.error.access_denied'))
    }

    try {
      const result = await scanFolder(resolved)
      lastScanResult = result
      const files = registerLargeFileTrashTargets(findLargeFiles(result.tree, limit), resolved, 'large')
      logInfoAction('disk-ipc', 'large_files.list', withRequestMeta(requestMeta, { path: resolved, limit, count: files.length }))
      return success(files)
    } catch (err) {
      logErrorAction('disk-ipc', 'large_files.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.large_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GET_EXTENSIONS, async (_event, folderPath: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_path'))
    }

    const resolved = path.resolve(folderPath)
    if (lastScanResult && path.resolve(lastScanResult.rootPath) === resolved) {
      const extensions = getExtensionBreakdown(lastScanResult.tree)
      logInfoAction('disk-ipc', 'extensions.list_cached', withRequestMeta(requestMeta, { path: resolved, count: extensions.length }))
      return success(extensions)
    }
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', tk('disk.error.access_denied'))
    }

    try {
      const result = await scanFolder(resolved)
      lastScanResult = result
      const extensions = getExtensionBreakdown(result.tree)
      logInfoAction('disk-ipc', 'extensions.list', withRequestMeta(requestMeta, { path: resolved, count: extensions.length }))
      return success(extensions)
    } catch (err) {
      logErrorAction('disk-ipc', 'extensions.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.extensions_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_QUICK_SCAN, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const results = await runQuickScan()
      logInfoAction('disk-ipc', 'quick_scan.run', withRequestMeta(requestMeta, { count: results.length }))
      return success(results)
    } catch (err) {
      logErrorAction('disk-ipc', 'quick_scan.run', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.quick_scan_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_USER_SPACE, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const info = await getUserSpaceInfo()
      logInfoAction('disk-ipc', 'user_space.get', withRequestMeta(requestMeta, {
        diskTotal: info.diskTotal,
        diskUsage: info.diskUsage
      }))
      return success(info)
    } catch (err) {
      logErrorAction('disk-ipc', 'user_space.get', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.user_space_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_RECENT_GROWTH, async (_event, folderPath: string, days: number = 7, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_path'))
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_days_short'))
    }
    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', tk('disk.error.access_denied'))
    }
    try {
      const results = await findRecentGrowth(resolved, days)
      logInfoAction('disk-ipc', 'recent_growth.list', withRequestMeta(requestMeta, { path: resolved, days, count: results.length }))
      return success(results)
    } catch (err) {
      logErrorAction('disk-ipc', 'recent_growth.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.recent_growth_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_FIND_DUPLICATES, async (_event, folderPath: string, minSizeKB: number = 100, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_path'))
    }
    if (!Number.isInteger(minSizeKB) || minSizeKB < 1 || minSizeKB > 1048576) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_min_size'))
    }
    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', tk('disk.error.access_denied'))
    }
    try {
      const results = registerDuplicateTrashTargets(await findDuplicates(resolved, minSizeKB * 1024), resolved)
      logInfoAction('disk-ipc', 'duplicates.list', withRequestMeta(requestMeta, { path: resolved, minSizeKB, count: results.length }))
      return success(results)
    } catch (err) {
      logErrorAction('disk-ipc', 'duplicates.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.duplicates_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GROWTH_VIEW, async (_event, period: string = '7d', metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!['1h', '24h', '7d'].includes(period)) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_growth_period'))
    }
    try {
      const result = await analyzeGrowth(period)
      logInfoAction('disk-ipc', 'growth_analysis.get', withRequestMeta(requestMeta, { period, folderCount: result.folders.length, totalAdded: result.totalAdded }))
      return success(result)
    } catch (err) {
      logErrorAction('disk-ipc', 'growth_analysis.get', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.growth_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_FIND_OLD_FILES, async (_event, folderPath: string, olderThanDays: number = 365, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_path'))
    }
    if (!Number.isInteger(olderThanDays) || olderThanDays < 1 || olderThanDays > 3650) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_old_days'))
    }
    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', tk('disk.error.access_denied'))
    }
    try {
      const results = registerLargeFileTrashTargets(await findOldFiles(resolved, olderThanDays), resolved, 'old')
      logInfoAction('disk-ipc', 'old_files.list', withRequestMeta(requestMeta, { path: resolved, olderThanDays, count: results.length }))
      return success(results)
    } catch (err) {
      logErrorAction('disk-ipc', 'old_files.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.old_files_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_TRASH_ITEMS, async (_event, request: TrashItemsRequest, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (
      !request ||
      typeof request !== 'object' ||
      !Array.isArray(request.itemIds) ||
      request.itemIds.length === 0 ||
      request.itemIds.some((itemId) => typeof itemId !== 'string' || !itemId.trim())
    ) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_trash_request'))
    }

    const uniqueIds = [...new Set(request.itemIds)]
    const targets = uniqueIds.map((itemId) => registeredTrashTargets.get(itemId))

    if (targets.some((target) => !target)) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_trash_target'))
    }
    const resolvedTargets = targets.filter((target): target is { path: string; rootPath: string; scope: 'large' | 'old' | 'duplicate' } => Boolean(target))

    try {
      const result = await trashItemsWithConfirm(
        resolvedTargets.map((target) => target.path),
        request.description || tk('disk.trash.description')
      )

      if (result.trashedPaths.length > 0) {
        const trashedPathSet = new Set(result.trashedPaths.map((targetPath) => path.resolve(targetPath)))
        for (const [itemId, target] of registeredTrashTargets) {
          if (trashedPathSet.has(path.resolve(target.path))) {
            registeredTrashTargets.delete(itemId)
          }
        }
      }

      logInfoAction('disk-ipc', 'trash_items.run', withRequestMeta(requestMeta, {
        requestedCount: resolvedTargets.length,
        trashedCount: result.trashedPaths.length,
        failedCount: result.failCount
      }))
      return success(result)
    } catch (err) {
      logErrorAction('disk-ipc', 'trash_items.run', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('disk.error.trash_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.JOB_CANCEL, (_event, jobId: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!jobId || typeof jobId !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_job_id'))
    }
    const cancelled = cancelJob(jobId)
    if (!cancelled) {
      return failure('JOB_NOT_FOUND', tk('disk.error.job_not_found'))
    }
    logInfoAction('disk-ipc', 'job.cancel', withRequestMeta(requestMeta, { jobId }))
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
