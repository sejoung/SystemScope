import { ipcMain, BrowserWindow, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
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
import { success, failure } from '@shared/types'
import type { AppResult } from '@shared/types'
import { logErrorAction, logInfoAction } from '../services/logging'
import { formatBytes } from '@shared/utils/formatBytes'
import { tk } from '../i18n'
import { getRequestMeta, isValidStringArray, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

interface ConfirmDialogOptions {
  actionButton: string
  title: string
  message: string
  detailLines: (string | null)[]
}

function getActiveWindow(): BrowserWindow | null {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  return win && !win.isDestroyed() ? win : null
}

async function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const win = getActiveWindow()
  if (!win) return false

  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: [tk('docker.ipc.confirm.cancel'), options.actionButton],
    defaultId: 0,
    cancelId: 0,
    title: options.title,
    message: options.message,
    detail: options.detailLines.filter(Boolean).join('\n')
  })

  return confirm.response !== 0
}

function buildTargetDetailLines(
  labels: string[],
  totalCount: number,
  footerLines: string[]
): (string | null)[] {
  return [
    ...labels.slice(0, 5),
    totalCount > 5 ? tk('docker.ipc.confirm.more', { count: totalCount - 5 }) : null,
    '',
    ...footerLines
  ]
}

export function registerDockerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DOCKER_LIST_IMAGES, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const result = await listDockerImages()
      logInfoAction('docker-ipc', 'images.list', withRequestMeta(requestMeta, {
        status: result.status,
        count: result.status === 'ready' ? result.images.length : 0
      }))
      return success(result)
    } catch (err) {
      logErrorAction('docker-ipc', 'images.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('docker.ipc.error.list_images'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_LIST_CONTAINERS, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const result = await listDockerContainers()
      logInfoAction('docker-ipc', 'containers.list', withRequestMeta(requestMeta, {
        status: result.status,
        count: result.status === 'ready' ? result.containers.length : 0
      }))
      return success(result)
    } catch (err) {
      logErrorAction('docker-ipc', 'containers.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('docker.ipc.error.list_containers'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_LIST_VOLUMES, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const result = await listDockerVolumes()
      logInfoAction('docker-ipc', 'volumes.list', withRequestMeta(requestMeta, {
        status: result.status,
        count: result.status === 'ready' ? result.volumes.length : 0
      }))
      return success(result)
    } catch (err) {
      logErrorAction('docker-ipc', 'volumes.list', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('docker.ipc.error.list_volumes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_GET_BUILD_CACHE, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const result = await getDockerBuildCache()
      logInfoAction('docker-ipc', 'build_cache.get', withRequestMeta(requestMeta, {
        status: result.status,
        totalCount: result.status === 'ready' ? (result.summary?.totalCount ?? 0) : 0
      }))
      return success(result)
    } catch (err) {
      logErrorAction('docker-ipc', 'build_cache.get', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', tk('docker.ipc.error.build_cache'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_REMOVE_IMAGES, async (_event, imageIds: string[], metaArg?: IpcRequestMetaArg): Promise<AppResult<never> | ReturnType<typeof success>> => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidStringArray(imageIds)) {
      return failure('INVALID_INPUT', tk('docker.ipc.error.no_images'))
    }

    try {
      const scan = await listDockerImages()
      if (scan.status !== 'ready') {
        return failure('UNKNOWN_ERROR', scan.message ?? tk('main.docker.status.daemon_unavailable'))
      }

      const targets = scan.images.filter((image) => imageIds.includes(image.id))
      if (targets.length === 0) {
        return failure('INVALID_INPUT', tk('docker.ipc.error.no_images_found'))
      }
      if (targets.some((image) => image.inUse)) {
        return failure('PERMISSION_DENIED', tk('docker.ipc.error.images_in_use'))
      }

      if (!getActiveWindow()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }

      const totalSize = targets.reduce((sum, image) => sum + image.sizeBytes, 0)
      const confirmed = await showConfirmDialog({
        actionButton: tk('docker.ipc.confirm.delete'),
        title: tk('docker.ipc.confirm.images_title'),
        message: tk('docker.ipc.confirm.images_message', { count: targets.length }),
        detailLines: buildTargetDetailLines(
          targets.map((image) => `- ${image.repository}:${image.tag} (${image.sizeLabel})`),
          targets.length,
          [tk('docker.ipc.confirm.total_size', { size: formatBytes(totalSize) }), tk('docker.ipc.confirm.images_note')]
        )
      })

      if (!confirmed) {
        logInfoAction('docker-ipc', 'images.remove.cancel', withRequestMeta(requestMeta, { requestedCount: imageIds.length }))
        return success({ deletedIds: [], failCount: 0, errors: [], cancelled: true })
      }

      const result = await removeDockerImages(targets.map((image) => image.id))
      logInfoAction('docker-ipc', 'images.remove', withRequestMeta(requestMeta, {
        requestedCount: targets.length,
        deletedCount: result.deletedIds.length,
        failCount: result.failCount
      }))
      return success(result)
    } catch (err) {
      logErrorAction('docker-ipc', 'images.remove', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.remove_images'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_REMOVE_CONTAINERS, async (_event, containerIds: string[], metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidStringArray(containerIds)) {
      return failure('INVALID_INPUT', tk('docker.ipc.error.no_containers'))
    }

    try {
      const scan = await listDockerContainers()
      if (scan.status !== 'ready') {
        return failure('UNKNOWN_ERROR', scan.message ?? tk('main.docker.status.daemon_unavailable'))
      }

      const targets = scan.containers.filter((container) => containerIds.includes(container.id))
      if (targets.length === 0) {
        return failure('INVALID_INPUT', tk('docker.ipc.error.no_containers_found'))
      }
      if (targets.some((container) => container.running)) {
        return failure('PERMISSION_DENIED', tk('docker.ipc.error.running_containers'))
      }

      if (!getActiveWindow()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }

      const totalSize = targets.reduce((sum, container) => sum + container.sizeBytes, 0)
      const confirmed = await showConfirmDialog({
        actionButton: tk('docker.ipc.confirm.delete'),
        title: tk('docker.ipc.confirm.containers_title'),
        message: tk('docker.ipc.confirm.containers_message', { count: targets.length }),
        detailLines: buildTargetDetailLines(
          targets.map((container) => `- ${container.name} (${container.image})`),
          targets.length,
          [tk('docker.ipc.confirm.total_size', { size: formatBytes(totalSize) }), tk('docker.ipc.confirm.containers_note')]
        )
      })

      if (!confirmed) {
        logInfoAction('docker-ipc', 'containers.remove.cancel', withRequestMeta(requestMeta, { requestedCount: containerIds.length }))
        return success({ deletedIds: [], failCount: 0, errors: [], cancelled: true })
      }

      const result = await removeDockerContainers(targets.map((container) => container.id))
      logInfoAction('docker-ipc', 'containers.remove', withRequestMeta(requestMeta, {
        requestedCount: targets.length,
        deletedCount: result.deletedIds.length,
        failCount: result.failCount
      }))
      return success(result)
    } catch (err) {
      logErrorAction('docker-ipc', 'containers.remove', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.remove_containers'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_STOP_CONTAINERS, async (_event, containerIds: string[], metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidStringArray(containerIds)) {
      return failure('INVALID_INPUT', tk('docker.ipc.error.no_stop_targets'))
    }

    try {
      const scan = await listDockerContainers()
      if (scan.status !== 'ready') {
        return failure('UNKNOWN_ERROR', scan.message ?? tk('main.docker.status.daemon_unavailable'))
      }

      const targets = scan.containers.filter((container) => containerIds.includes(container.id))
      if (targets.length === 0) {
        return failure('INVALID_INPUT', tk('docker.ipc.error.no_stop_found'))
      }
      if (targets.some((container) => !container.running)) {
        return failure('PERMISSION_DENIED', tk('docker.ipc.error.already_stopped'))
      }

      if (!getActiveWindow()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }

      const confirmed = await showConfirmDialog({
        actionButton: tk('docker.ipc.confirm.stop'),
        title: tk('docker.ipc.confirm.stop_title'),
        message: tk('docker.ipc.confirm.stop_message', { count: targets.length }),
        detailLines: buildTargetDetailLines(
          targets.map((container) => `- ${container.name} (${container.image})`),
          targets.length,
          [tk('docker.ipc.confirm.stop_note')]
        )
      })

      if (!confirmed) {
        logInfoAction('docker-ipc', 'containers.stop.cancel', withRequestMeta(requestMeta, { requestedCount: containerIds.length }))
        return success({ affectedIds: [], failCount: 0, errors: [], cancelled: true })
      }

      const result = await stopDockerContainers(targets.map((container) => container.id))
      logInfoAction('docker-ipc', 'containers.stop', withRequestMeta(requestMeta, {
        requestedCount: targets.length,
        affectedCount: result.affectedIds.length,
        failCount: result.failCount
      }))
      return success(result)
    } catch (err) {
      logErrorAction('docker-ipc', 'containers.stop', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.stop_containers'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_REMOVE_VOLUMES, async (_event, volumeNames: string[], metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidStringArray(volumeNames)) {
      return failure('INVALID_INPUT', tk('docker.ipc.error.no_volumes'))
    }

    try {
      const scan = await listDockerVolumes()
      if (scan.status !== 'ready') {
        return failure('UNKNOWN_ERROR', scan.message ?? tk('main.docker.status.daemon_unavailable'))
      }

      const targets = scan.volumes.filter((volume) => volumeNames.includes(volume.name))
      if (targets.length === 0) {
        return failure('INVALID_INPUT', tk('docker.ipc.error.no_volumes_found'))
      }
      if (targets.some((volume) => volume.inUse)) {
        return failure('PERMISSION_DENIED', tk('docker.ipc.error.volumes_in_use'))
      }

      if (!getActiveWindow()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }

      const confirmed = await showConfirmDialog({
        actionButton: tk('docker.ipc.confirm.delete'),
        title: tk('docker.ipc.confirm.volumes_title'),
        message: tk('docker.ipc.confirm.volumes_message', { count: targets.length }),
        detailLines: buildTargetDetailLines(
          targets.map((volume) => `- ${volume.name} (${volume.driver})`),
          targets.length,
          [tk('docker.ipc.confirm.volumes_note')]
        )
      })

      if (!confirmed) {
        logInfoAction('docker-ipc', 'volumes.remove.cancel', withRequestMeta(requestMeta, { requestedCount: volumeNames.length }))
        return success({ deletedIds: [], failCount: 0, errors: [], cancelled: true })
      }

      const result = await removeDockerVolumes(targets.map((volume) => volume.name))
      logInfoAction('docker-ipc', 'volumes.remove', withRequestMeta(requestMeta, {
        requestedCount: targets.length,
        deletedCount: result.deletedIds.length,
        failCount: result.failCount
      }))
      return success(result)
    } catch (err) {
      logErrorAction('docker-ipc', 'volumes.remove', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.remove_volumes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_PRUNE_BUILD_CACHE, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const cache = await getDockerBuildCache()
      if (cache.status !== 'ready') {
        return failure('UNKNOWN_ERROR', cache.message ?? tk('main.docker.status.daemon_unavailable'))
      }

      if (!getActiveWindow()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }

      const confirmed = await showConfirmDialog({
        actionButton: tk('docker.ipc.confirm.cleanup'),
        title: tk('docker.ipc.confirm.cache_title'),
        message: tk('docker.ipc.confirm.cache_message'),
        detailLines: [tk('docker.ipc.confirm.cache_detail', { size: cache.summary?.reclaimableLabel ?? '0 B' })]
      })

      if (!confirmed) {
        logInfoAction('docker-ipc', 'build_cache.prune.cancel', withRequestMeta(requestMeta))
        return success({ reclaimedBytes: 0, reclaimedLabel: '0 B', cancelled: true })
      }

      const result = await pruneDockerBuildCache()
      logInfoAction('docker-ipc', 'build_cache.prune', withRequestMeta(requestMeta, {
        reclaimedBytes: result.reclaimedBytes,
        reclaimedLabel: result.reclaimedLabel
      }))
      return success(result)
    } catch (err) {
      logErrorAction('docker-ipc', 'build_cache.prune', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.prune_cache'))
    }
  })
}
