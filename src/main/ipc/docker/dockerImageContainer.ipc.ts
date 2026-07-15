import { ipcMain } from '../_shared/trustedIpc'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { listDockerContainers, listDockerImages, removeDockerContainers, removeDockerImages, stopDockerContainers } from '@main/services/docker'
import { success, failure, type AppResult } from '@shared/types'
import { logErrorAction, logInfoAction } from '@main/services/core'
import { formatBytes } from '@shared/utils/formatBytes'
import { tk } from '../../i18n'
import { getRequestMeta, isValidStringArray, withRequestMeta, type IpcRequestMetaArg } from '../_shared/requestContext'
import { recordEvent } from '@main/services/history'
import { buildTargetDetailLines, getActiveWindow, showConfirmDialog } from './dockerConfirmation'

export function registerDockerImageContainerIpc(): void {
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
      if (result.deletedIds.length > 0) {
        void recordEvent('docker_cleanup', 'info', `Removed ${result.deletedIds.length} Docker image(s)`, undefined, {
          deletedCount: result.deletedIds.length,
          failCount: result.failCount
        })
      }
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
      if (result.deletedIds.length > 0) {
        void recordEvent('docker_cleanup', 'info', `Removed ${result.deletedIds.length} Docker container(s)`, undefined, {
          deletedCount: result.deletedIds.length,
          failCount: result.failCount
        })
      }
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

}
