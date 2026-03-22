import { ipcMain, BrowserWindow, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { scanFolder, findLargeFiles, getExtensionBreakdown } from '../services/diskAnalyzer'
import { runQuickScan } from '../services/quickScan'
import { getUserSpaceInfo } from '../services/userSpace'
import { findRecentGrowth, findDuplicates } from '../services/diskInsights'
import { analyzeGrowth } from '../services/growthAnalyzer'
import { findOldFiles } from '../services/oldFileFinder'
import {
  getDockerBuildCache,
  listDockerContainers,
  listDockerImages,
  listDockerVolumes,
  pruneDockerBuildCache,
  removeDockerContainers,
  removeDockerImages,
  removeDockerVolumes,
  stopDockerContainers
} from '../services/dockerImages'
import { createJob, cancelJob, sendJobProgress, sendJobCompleted, sendJobFailed } from '../jobs/jobManager'
import { success, failure } from '@shared/types'
import type { DiskScanResult, DockerRemoveResult } from '@shared/types'
import { logError } from '../services/logging'

// Cache last scan result for large files / extension queries
let lastScanResult: DiskScanResult | null = null

export function registerDiskIpc(): void {
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
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          sendJobProgress(win, job, -1, `스캔 중: ${path.basename(current)} (${fileCount}개 파일)`)
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
            sendJobFailed(win, job, '스캔이 취소되었습니다.')
          }
        } else {
          logError('disk-ipc', 'Disk scan failed', err)
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            sendJobFailed(win, job, '디스크 스캔 중 오류가 발생했습니다.')
          }
        }
      })

    return success({ jobId: job.id })
  })

  ipcMain.handle(IPC_CHANNELS.DISK_INVALIDATE_SCAN_CACHE, (_event, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }

    const resolved = path.resolve(folderPath)
    if (lastScanResult && path.resolve(lastScanResult.rootPath) === resolved) {
      lastScanResult = null
    }

    return success(true)
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GET_LARGE_FILES, async (_event, folderPath: string, limit: number) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
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
      logError('disk-ipc', 'Large file scan failed', err)
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
      logError('disk-ipc', 'Extension breakdown failed', err)
      return failure('SCAN_FAILED', '확장자 분석에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_QUICK_SCAN, async () => {
    try {
      const results = await runQuickScan()
      return success(results)
    } catch (err) {
      logError('disk-ipc', 'Quick scan failed', err)
      return failure('SCAN_FAILED', '빠른 스캔에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_USER_SPACE, async () => {
    try {
      const info = await getUserSpaceInfo()
      return success(info)
    } catch (err) {
      logError('disk-ipc', 'User space scan failed', err)
      return failure('SCAN_FAILED', '사용자 공간 분석에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_RECENT_GROWTH, async (_event, folderPath: string, days: number = 7) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }
    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', '폴더에 접근할 수 없습니다.')
    }
    try {
      const results = await findRecentGrowth(resolved, days)
      return success(results)
    } catch (err) {
      logError('disk-ipc', 'Recent growth scan failed', err)
      return failure('SCAN_FAILED', '최근 변경 분석에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_FIND_DUPLICATES, async (_event, folderPath: string, minSizeKB: number = 100) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }
    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', '폴더에 접근할 수 없습니다.')
    }
    try {
      const results = await findDuplicates(resolved, minSizeKB * 1024)
      return success(results)
    } catch (err) {
      logError('disk-ipc', 'Duplicate scan failed', err)
      return failure('SCAN_FAILED', '중복 파일 탐색에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GROWTH_VIEW, async (_event, period: string = '7d') => {
    if (!['1h', '24h', '7d'].includes(period)) {
      return failure('INVALID_INPUT', '유효하지 않은 기간입니다. (1h, 24h, 7d)')
    }
    try {
      const result = await analyzeGrowth(period)
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Growth analysis failed', err)
      return failure('SCAN_FAILED', '성장 분석에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_FIND_OLD_FILES, async (_event, folderPath: string, olderThanDays: number = 365) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 경로입니다.')
    }
    const resolved = path.resolve(folderPath)
    try {
      await fs.access(resolved, fs.constants.R_OK)
    } catch {
      return failure('PERMISSION_DENIED', '폴더에 접근할 수 없습니다.')
    }
    try {
      const results = await findOldFiles(resolved, olderThanDays)
      return success(results)
    } catch (err) {
      logError('disk-ipc', 'Old file scan failed', err)
      return failure('SCAN_FAILED', '오래된 파일 탐색에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_LIST_DOCKER_IMAGES, async () => {
    try {
      const result = await listDockerImages()
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Docker image scan failed', err)
      return failure('SCAN_FAILED', 'Docker 이미지를 조회할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_LIST_DOCKER_CONTAINERS, async () => {
    try {
      const result = await listDockerContainers()
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Docker container scan failed', err)
      return failure('SCAN_FAILED', 'Docker 컨테이너를 조회할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_LIST_DOCKER_VOLUMES, async () => {
    try {
      const result = await listDockerVolumes()
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Docker volume scan failed', err)
      return failure('SCAN_FAILED', 'Docker 볼륨을 조회할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_GET_DOCKER_BUILD_CACHE, async () => {
    try {
      const result = await getDockerBuildCache()
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Docker build cache scan failed', err)
      return failure('SCAN_FAILED', 'Docker build cache를 조회할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_REMOVE_DOCKER_IMAGES, async (_event, imageIds: string[]) => {
    if (!Array.isArray(imageIds) || imageIds.length === 0 || imageIds.some((id) => typeof id !== 'string' || !id.trim())) {
      return failure('INVALID_INPUT', '삭제할 Docker 이미지가 없습니다.')
    }

    try {
      const scan = await listDockerImages()
      if (scan.status !== 'ready') {
        return failure('UNKNOWN_ERROR', scan.message ?? 'Docker를 사용할 수 없습니다.')
      }

      const targets = scan.images.filter((image) => imageIds.includes(image.id))
      if (targets.length === 0) {
        return failure('INVALID_INPUT', '삭제할 Docker 이미지를 찾을 수 없습니다.')
      }
      if (targets.some((image) => image.inUse)) {
        return failure('PERMISSION_DENIED', '사용 중인 Docker 이미지는 삭제할 수 없습니다.')
      }

      const totalSize = targets.reduce((sum, image) => sum + image.sizeBytes, 0)
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', '활성 창을 찾을 수 없습니다.')
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        cancelId: 0,
        title: 'Delete Docker Images',
        message: `${targets.length}개의 Docker 이미지를 삭제하시겠습니까?`,
        detail: [
          ...targets.slice(0, 5).map((image) => `- ${image.repository}:${image.tag} (${image.sizeLabel})`),
          targets.length > 5 ? `- ... 외 ${targets.length - 5}개` : null,
          '',
          `총 크기: ${formatDockerBytes(totalSize)}`,
          '사용 중인 이미지는 삭제 대상에서 제외됩니다.'
        ].filter(Boolean).join('\n')
      })

      if (confirm.response === 0) {
        const result: DockerRemoveResult = {
          deletedIds: [],
          failCount: 0,
          errors: [],
          cancelled: true
        }
        return success(result)
      }

      const result = await removeDockerImages(targets.map((image) => image.id))
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Docker image remove failed', err)
      return failure('UNKNOWN_ERROR', 'Docker 이미지를 삭제할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_REMOVE_DOCKER_CONTAINERS, async (_event, containerIds: string[]) => {
    if (
      !Array.isArray(containerIds) ||
      containerIds.length === 0 ||
      containerIds.some((id) => typeof id !== 'string' || !id.trim())
    ) {
      return failure('INVALID_INPUT', '삭제할 Docker 컨테이너가 없습니다.')
    }

    try {
      const scan = await listDockerContainers()
      if (scan.status !== 'ready') {
        return failure('UNKNOWN_ERROR', scan.message ?? 'Docker를 사용할 수 없습니다.')
      }

      const targets = scan.containers.filter((container) => containerIds.includes(container.id))
      if (targets.length === 0) {
        return failure('INVALID_INPUT', '삭제할 Docker 컨테이너를 찾을 수 없습니다.')
      }
      if (targets.some((container) => container.running)) {
        return failure('PERMISSION_DENIED', '실행 중인 Docker 컨테이너는 먼저 중지해야 합니다.')
      }

      const totalSize = targets.reduce((sum, container) => sum + container.sizeBytes, 0)
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', '활성 창을 찾을 수 없습니다.')
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        cancelId: 0,
        title: 'Delete Docker Containers',
        message: `${targets.length}개의 Docker 컨테이너를 삭제하시겠습니까?`,
        detail: [
          ...targets.slice(0, 5).map((container) => `- ${container.name} (${container.image})`),
          targets.length > 5 ? `- ... 외 ${targets.length - 5}개` : null,
          '',
          `총 크기: ${formatDockerBytes(totalSize)}`,
          '실행 중인 컨테이너는 삭제 대상에서 제외됩니다.'
        ]
          .filter(Boolean)
          .join('\n')
      })

      if (confirm.response === 0) {
        const result: DockerRemoveResult = {
          deletedIds: [],
          failCount: 0,
          errors: [],
          cancelled: true
        }
        return success(result)
      }

      const result = await removeDockerContainers(targets.map((container) => container.id))
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Docker container remove failed', err)
      return failure('UNKNOWN_ERROR', 'Docker 컨테이너를 삭제할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_STOP_DOCKER_CONTAINERS, async (_event, containerIds: string[]) => {
    if (
      !Array.isArray(containerIds) ||
      containerIds.length === 0 ||
      containerIds.some((id) => typeof id !== 'string' || !id.trim())
    ) {
      return failure('INVALID_INPUT', '중지할 Docker 컨테이너가 없습니다.')
    }

    try {
      const scan = await listDockerContainers()
      if (scan.status !== 'ready') {
        return failure('UNKNOWN_ERROR', scan.message ?? 'Docker를 사용할 수 없습니다.')
      }

      const targets = scan.containers.filter((container) => containerIds.includes(container.id))
      if (targets.length === 0) {
        return failure('INVALID_INPUT', '중지할 Docker 컨테이너를 찾을 수 없습니다.')
      }
      if (targets.some((container) => !container.running)) {
        return failure('PERMISSION_DENIED', '이미 중지된 컨테이너는 중지할 수 없습니다.')
      }

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', '활성 창을 찾을 수 없습니다.')
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Cancel', 'Stop'],
        defaultId: 0,
        cancelId: 0,
        title: 'Stop Docker Containers',
        message: `${targets.length}개의 Docker 컨테이너를 중지하시겠습니까?`,
        detail: [
          ...targets.slice(0, 5).map((container) => `- ${container.name} (${container.image})`),
          targets.length > 5 ? `- ... 외 ${targets.length - 5}개` : null,
          '',
          '중지 후 Containers 탭에서 삭제하거나 Images 탭에서 참조 이미지를 정리할 수 있습니다.'
        ]
          .filter(Boolean)
          .join('\n')
      })

      if (confirm.response === 0) {
        return success({ affectedIds: [], failCount: 0, errors: [], cancelled: true })
      }

      const result = await stopDockerContainers(targets.map((container) => container.id))
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Docker container stop failed', err)
      return failure('UNKNOWN_ERROR', 'Docker 컨테이너를 중지할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_REMOVE_DOCKER_VOLUMES, async (_event, volumeNames: string[]) => {
    if (
      !Array.isArray(volumeNames) ||
      volumeNames.length === 0 ||
      volumeNames.some((name) => typeof name !== 'string' || !name.trim())
    ) {
      return failure('INVALID_INPUT', '삭제할 Docker 볼륨이 없습니다.')
    }

    try {
      const scan = await listDockerVolumes()
      if (scan.status !== 'ready') {
        return failure('UNKNOWN_ERROR', scan.message ?? 'Docker를 사용할 수 없습니다.')
      }

      const targets = scan.volumes.filter((volume) => volumeNames.includes(volume.name))
      if (targets.length === 0) {
        return failure('INVALID_INPUT', '삭제할 Docker 볼륨을 찾을 수 없습니다.')
      }
      if (targets.some((volume) => volume.inUse)) {
        return failure('PERMISSION_DENIED', '사용 중인 Docker 볼륨은 삭제할 수 없습니다.')
      }

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', '활성 창을 찾을 수 없습니다.')
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        cancelId: 0,
        title: 'Delete Docker Volumes',
        message: `${targets.length}개의 Docker 볼륨을 삭제하시겠습니까?`,
        detail: [
          ...targets.slice(0, 5).map((volume) => `- ${volume.name} (${volume.driver})`),
          targets.length > 5 ? `- ... 외 ${targets.length - 5}개` : null,
          '',
          '사용 중인 볼륨은 삭제 대상에서 제외됩니다.'
        ]
          .filter(Boolean)
          .join('\n')
      })

      if (confirm.response === 0) {
        return success({ deletedIds: [], failCount: 0, errors: [], cancelled: true })
      }

      const result = await removeDockerVolumes(targets.map((volume) => volume.name))
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Docker volume remove failed', err)
      return failure('UNKNOWN_ERROR', 'Docker 볼륨을 삭제할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DISK_PRUNE_DOCKER_BUILD_CACHE, async () => {
    try {
      const cache = await getDockerBuildCache()
      if (cache.status !== 'ready') {
        return failure('UNKNOWN_ERROR', cache.message ?? 'Docker를 사용할 수 없습니다.')
      }

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', '활성 창을 찾을 수 없습니다.')
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Cancel', 'Prune'],
        defaultId: 0,
        cancelId: 0,
        title: 'Prune Docker Build Cache',
        message: 'Docker build cache를 정리하시겠습니까?',
        detail: `현재 회수 가능 용량: ${cache.summary?.reclaimableLabel ?? '0 B'}`
      })

      if (confirm.response === 0) {
        return success({ reclaimedBytes: 0, reclaimedLabel: '0 B', cancelled: true })
      }

      const result = await pruneDockerBuildCache()
      return success(result)
    } catch (err) {
      logError('disk-ipc', 'Docker build cache prune failed', err)
      return failure('UNKNOWN_ERROR', 'Docker build cache를 정리할 수 없습니다.')
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

function formatDockerBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
