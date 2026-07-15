import { BrowserWindow } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { ipcMain } from './_shared/trustedIpc'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { scanFolder, findLargeFiles, getExtensionBreakdown } from '@main/services/disk'
import { createJob, sendJobProgress, sendJobCompleted, sendJobFailed } from '../jobs/jobManager'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction, logProductMetric } from '@main/services/core'
import { tk } from '../i18n'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './_shared/requestContext'
import { registerShellPath, registerShellPaths } from '@main/services/devtools'
import { getScanCache, invalidateScanCache, registerLargeFileTrashTargets, setScanCache } from './diskIpcState'

const MAX_LARGE_FILE_LIMIT = 500
export function registerDiskScanIpc(): void {
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
    registerShellPath(resolved)

    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (!win || win.isDestroyed()) {
      return failure('UNKNOWN_ERROR', tk('disk.error.no_active_window'))
    }

    const job = createJob('diskScan')
    job.status = 'running'
    logInfoAction('disk-ipc', 'scan.start', withRequestMeta(requestMeta, { jobId: job.id, path: resolved }))
    logProductMetric('disk-ipc', 'disk.scan', 'started', withRequestMeta(requestMeta, { jobId: job.id, path: resolved }))

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
        setScanCache(result)
        logInfoAction('disk-ipc', 'scan.complete', withRequestMeta(requestMeta, {
          jobId: job.id,
          path: resolved,
          totalSize: result.totalSize
        }))
        logProductMetric('disk-ipc', 'disk.scan', 'succeeded', withRequestMeta(requestMeta, {
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
          logProductMetric('disk-ipc', 'disk.scan', 'cancelled', withRequestMeta(requestMeta, { jobId: job.id, path: resolved }))
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            sendJobFailed(win, job, tk('disk.scan.cancelled'))
          }
        } else {
          logErrorAction('disk-ipc', 'scan.run', withRequestMeta(requestMeta, { error: err }))
          logProductMetric('disk-ipc', 'disk.scan', 'failed', withRequestMeta(requestMeta, { jobId: job.id, path: resolved, error: err }))
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
    invalidateScanCache(resolved)
    logInfoAction('disk-ipc', 'scan_cache.invalidate', withRequestMeta(requestMeta, { path: resolved }))

    return success(true)
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GET_LARGE_FILES, async (_event, folderPath: string, limit: number, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_path'))
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LARGE_FILE_LIMIT) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_limit'))
    }

    const resolved = path.resolve(folderPath)

    // 해당 경로의 캐시된 결과가 있으면 사용
    const cached = getScanCache(resolved)
    if (cached) {
      const files = registerLargeFileTrashTargets(
        (cached.derivedLargeFiles ?? findLargeFiles(cached.result.tree, limit)).slice(0, limit),
        resolved,
        'large'
      )
      registerShellPaths(files.map((file) => file.path))
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
      setScanCache(result)
      const files = registerLargeFileTrashTargets(
        (result.topLargeFiles ?? findLargeFiles(result.tree, limit)).slice(0, limit),
        resolved,
        'large'
      )
      registerShellPaths(files.map((file) => file.path))
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
    const cachedExt = getScanCache(resolved)
    if (cachedExt) {
      const extensions = cachedExt.derivedExtensionBreakdown ?? getExtensionBreakdown(cachedExt.result.tree)
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
      setScanCache(result)
      const extensions = result.extensionBreakdown ?? getExtensionBreakdown(result.tree)
      logInfoAction('disk-ipc', 'extensions.list', withRequestMeta(requestMeta, { path: resolved, count: extensions.length }))
      return success(extensions)
    } catch (err) {
      logErrorAction('disk-ipc', 'extensions.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('disk.error.extensions_failed'))
    }
  })

}
