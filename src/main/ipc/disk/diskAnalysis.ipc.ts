import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { ipcMain } from '../_shared/trustedIpc'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { analyzeGrowth, findDuplicates, findOldFiles, findRecentGrowth, getUserSpaceInfo, runQuickScan } from '@main/services/disk'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction, logProductMetric } from '@main/services/core'
import { tk } from '../../i18n'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from '../_shared/requestContext'
import { registerShellPath, registerShellPaths } from '@main/services/devtools'
import { registerDuplicateTrashTargets, registerLargeFileTrashTargets } from './diskIpcState'

const MAX_GROWTH_DAYS = 365
const MAX_DUPLICATE_MIN_SIZE_KB = 1048576
const DEFAULT_OLD_FILE_DAYS = 365
const MAX_OLD_FILE_DAYS = 3650
export function registerDiskAnalysisIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DISK_QUICK_SCAN, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const results = await runQuickScan()
      registerShellPaths(results.map((result) => result.path))
      logInfoAction('disk-ipc', 'quick_scan.run', withRequestMeta(requestMeta, { count: results.length }))
      logProductMetric('disk-ipc', 'disk.quick_scan', 'succeeded', withRequestMeta(requestMeta, { count: results.length }))
      return success(results)
    } catch (err) {
      logErrorAction('disk-ipc', 'quick_scan.run', withRequestMeta(requestMeta, { error: err }))
      logProductMetric('disk-ipc', 'disk.quick_scan', 'failed', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.quick_scan_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_USER_SPACE, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const info = await getUserSpaceInfo()
      registerShellPath(info.homePath)
      registerShellPaths(info.entries.map((entry) => entry.path))
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
    if (!Number.isInteger(days) || days < 1 || days > MAX_GROWTH_DAYS) {
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
      registerShellPaths(results.map((result) => result.path))
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
    if (!Number.isInteger(minSizeKB) || minSizeKB < 1 || minSizeKB > MAX_DUPLICATE_MIN_SIZE_KB) {
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
      registerShellPaths(results.flatMap((group) => group.files.map((file) => file.path)))
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
      registerShellPaths(result.folders.map((folder) => folder.path))
      logInfoAction('disk-ipc', 'growth_analysis.get', withRequestMeta(requestMeta, { period, folderCount: result.folders.length, totalAdded: result.totalAdded }))
      return success(result)
    } catch (err) {
      logErrorAction('disk-ipc', 'growth_analysis.get', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.growth_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_FIND_OLD_FILES, async (_event, folderPath: string, olderThanDays: number = DEFAULT_OLD_FILE_DAYS, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_path'))
    }
    if (!Number.isInteger(olderThanDays) || olderThanDays < 1 || olderThanDays > MAX_OLD_FILE_DAYS) {
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
      registerShellPaths(results.map((result) => result.path))
      logInfoAction('disk-ipc', 'old_files.list', withRequestMeta(requestMeta, { path: resolved, olderThanDays, count: results.length }))
      return success(results)
    } catch (err) {
      logErrorAction('disk-ipc', 'old_files.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.old_files_failed'))
    }
  })

}
