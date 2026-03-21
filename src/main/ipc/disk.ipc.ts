import { ipcMain, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getDrives, scanFolder, findLargeFiles, getExtensionBreakdown } from '../services/diskAnalyzer'
import { runQuickScan } from '../services/quickScan'
import { getUserSpaceInfo } from '../services/userSpace'
import { createJob, cancelJob, sendJobProgress, sendJobCompleted, sendJobFailed } from '../jobs/jobManager'
import { success, failure } from '@shared/types'
import type { DiskScanResult } from '@shared/types'
import log from 'electron-log'

// Cache last scan result for large files / extension queries
let lastScanResult: DiskScanResult | null = null

export function registerDiskIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DISK_GET_DRIVES, async () => {
    try {
      const drives = await getDrives()
      return success(drives)
    } catch (err) {
      log.error('Failed to get drives', err)
      return failure('UNKNOWN_ERROR', '드라이브 정보를 가져올 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_SCAN_FOLDER, async (_event, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }

    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', '폴더에 접근할 수 없습니다.')
    }

    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      return failure('UNKNOWN_ERROR', '활성 창을 찾을 수 없습니다.')
    }

    const job = createJob('diskScan')
    job.status = 'running'

    // Run scan async, return job id immediately
    scanFolder(
      resolved,
      (current, fileCount) => {
        sendJobProgress(win, job, -1, `스캔 중: ${path.basename(current)} (${fileCount}개 파일)`)
      },
      job.abortController.signal
    )
      .then((result) => {
        lastScanResult = result
        sendJobCompleted(win, job, result)
      })
      .catch((err) => {
        if (err instanceof Error && err.message === 'Scan cancelled') {
          sendJobFailed(win, job, '스캔이 취소되었습니다.')
        } else {
          log.error('Disk scan failed', err)
          sendJobFailed(win, job, '디스크 스캔 중 오류가 발생했습니다.')
        }
      })

    return success({ jobId: job.id })
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GET_LARGE_FILES, async (_event, folderPath: string, limit: number) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }
    if (typeof limit !== 'number' || limit < 1 || limit > 500) {
      return failure('INVALID_INPUT', '유효하지 않은 limit 값입니다.')
    }

    // If we have a cached result for this path, use it
    if (lastScanResult && lastScanResult.rootPath === folderPath) {
      return success(findLargeFiles(lastScanResult.tree, limit))
    }

    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', '폴더에 접근할 수 없습니다.')
    }

    try {
      const result = await scanFolder(resolved)
      lastScanResult = result
      return success(findLargeFiles(result.tree, limit))
    } catch (err) {
      log.error('Large file scan failed', err)
      return failure('SCAN_FAILED', '대용량 파일 탐색에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GET_EXTENSIONS, async (_event, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }

    if (lastScanResult && lastScanResult.rootPath === folderPath) {
      return success(getExtensionBreakdown(lastScanResult.tree))
    }

    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', '폴더에 접근할 수 없습니다.')
    }

    try {
      const result = await scanFolder(resolved)
      lastScanResult = result
      return success(getExtensionBreakdown(result.tree))
    } catch (err) {
      log.error('Extension breakdown failed', err)
      return failure('SCAN_FAILED', '확장자 분석에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_QUICK_SCAN, async () => {
    try {
      const results = await runQuickScan()
      return success(results)
    } catch (err) {
      log.error('Quick scan failed', err)
      return failure('SCAN_FAILED', '빠른 스캔에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_USER_SPACE, async () => {
    try {
      const info = await getUserSpaceInfo()
      return success(info)
    } catch (err) {
      log.error('User space scan failed', err)
      return failure('SCAN_FAILED', '사용자 공간 분석에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.JOB_CANCEL, (_event, jobId: string) => {
    if (!jobId || typeof jobId !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 작업 ID입니다.')
    }
    const cancelled = cancelJob(jobId)
    if (!cancelled) {
      return failure('JOB_NOT_FOUND', '취소할 수 있는 작업을 찾을 수 없습니다.')
    }
    return success(true)
  })
}
