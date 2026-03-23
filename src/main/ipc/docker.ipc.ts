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
import type { DockerRemoveResult } from '@shared/types'
import { logError } from '../services/logging'
import { formatBytes } from '@shared/utils/formatBytes'
import { tk } from '../i18n'

export function registerDockerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DOCKER_LIST_IMAGES, async () => {
    try {
      const result = await listDockerImages()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Failed to list Docker images', err)
      return failure('SCAN_FAILED', tk('docker.ipc.error.list_images'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_LIST_CONTAINERS, async () => {
    try {
      const result = await listDockerContainers()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Failed to list Docker containers', err)
      return failure('SCAN_FAILED', tk('docker.ipc.error.list_containers'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_LIST_VOLUMES, async () => {
    try {
      const result = await listDockerVolumes()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Failed to list Docker volumes', err)
      return failure('SCAN_FAILED', tk('docker.ipc.error.list_volumes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_GET_BUILD_CACHE, async () => {
    try {
      const result = await getDockerBuildCache()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Failed to load Docker build cache', err)
      return failure('SCAN_FAILED', tk('docker.ipc.error.build_cache'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_REMOVE_IMAGES, async (_event, imageIds: string[]) => {
    if (!Array.isArray(imageIds) || imageIds.length === 0 || imageIds.some((id) => typeof id !== 'string' || !id.trim())) {
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

      const totalSize = targets.reduce((sum, image) => sum + image.sizeBytes, 0)
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: [tk('docker.ipc.confirm.cancel'), tk('docker.ipc.confirm.delete')],
        defaultId: 0,
        cancelId: 0,
        title: tk('docker.ipc.confirm.images_title'),
        message: tk('docker.ipc.confirm.images_message', { count: targets.length }),
        detail: [
          ...targets.slice(0, 5).map((image) => `- ${image.repository}:${image.tag} (${image.sizeLabel})`),
          targets.length > 5 ? tk('docker.ipc.confirm.more', { count: targets.length - 5 }) : null,
          '',
          tk('docker.ipc.confirm.total_size', { size: formatBytes(totalSize) }),
          tk('docker.ipc.confirm.images_note')
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
      logError('docker-ipc', 'Failed to remove Docker images', err)
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.remove_images'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_REMOVE_CONTAINERS, async (_event, containerIds: string[]) => {
    if (
      !Array.isArray(containerIds) ||
      containerIds.length === 0 ||
      containerIds.some((id) => typeof id !== 'string' || !id.trim())
    ) {
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

      const totalSize = targets.reduce((sum, container) => sum + container.sizeBytes, 0)
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: [tk('docker.ipc.confirm.cancel'), tk('docker.ipc.confirm.delete')],
        defaultId: 0,
        cancelId: 0,
        title: tk('docker.ipc.confirm.containers_title'),
        message: tk('docker.ipc.confirm.containers_message', { count: targets.length }),
        detail: [
          ...targets.slice(0, 5).map((container) => `- ${container.name} (${container.image})`),
          targets.length > 5 ? tk('docker.ipc.confirm.more', { count: targets.length - 5 }) : null,
          '',
          tk('docker.ipc.confirm.total_size', { size: formatBytes(totalSize) }),
          tk('docker.ipc.confirm.containers_note')
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
      logError('docker-ipc', 'Failed to remove Docker containers', err)
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.remove_containers'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_STOP_CONTAINERS, async (_event, containerIds: string[]) => {
    if (
      !Array.isArray(containerIds) ||
      containerIds.length === 0 ||
      containerIds.some((id) => typeof id !== 'string' || !id.trim())
    ) {
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

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: [tk('docker.ipc.confirm.cancel'), tk('docker.ipc.confirm.stop')],
        defaultId: 0,
        cancelId: 0,
        title: tk('docker.ipc.confirm.stop_title'),
        message: tk('docker.ipc.confirm.stop_message', { count: targets.length }),
        detail: [
          ...targets.slice(0, 5).map((container) => `- ${container.name} (${container.image})`),
          targets.length > 5 ? tk('docker.ipc.confirm.more', { count: targets.length - 5 }) : null,
          '',
          tk('docker.ipc.confirm.stop_note')
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
      logError('docker-ipc', 'Failed to stop Docker containers', err)
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.stop_containers'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_REMOVE_VOLUMES, async (_event, volumeNames: string[]) => {
    if (
      !Array.isArray(volumeNames) ||
      volumeNames.length === 0 ||
      volumeNames.some((name) => typeof name !== 'string' || !name.trim())
    ) {
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

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: [tk('docker.ipc.confirm.cancel'), tk('docker.ipc.confirm.delete')],
        defaultId: 0,
        cancelId: 0,
        title: tk('docker.ipc.confirm.volumes_title'),
        message: tk('docker.ipc.confirm.volumes_message', { count: targets.length }),
        detail: [
          ...targets.slice(0, 5).map((volume) => `- ${volume.name} (${volume.driver})`),
          targets.length > 5 ? tk('docker.ipc.confirm.more', { count: targets.length - 5 }) : null,
          '',
          tk('docker.ipc.confirm.volumes_note')
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
      logError('docker-ipc', 'Failed to remove Docker volumes', err)
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.remove_volumes'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_PRUNE_BUILD_CACHE, async () => {
    try {
      const cache = await getDockerBuildCache()
      if (cache.status !== 'ready') {
        return failure('UNKNOWN_ERROR', cache.message ?? tk('main.docker.status.daemon_unavailable'))
      }

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) {
        return failure('UNKNOWN_ERROR', tk('main.settings.error.no_active_window'))
      }
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: [tk('docker.ipc.confirm.cancel'), tk('docker.ipc.confirm.cleanup')],
        defaultId: 0,
        cancelId: 0,
        title: tk('docker.ipc.confirm.cache_title'),
        message: tk('docker.ipc.confirm.cache_message'),
        detail: tk('docker.ipc.confirm.cache_detail', { size: cache.summary?.reclaimableLabel ?? '0 B' })
      })

      if (confirm.response === 0) {
        return success({ reclaimedBytes: 0, reclaimedLabel: '0 B', cancelled: true })
      }

      const result = await pruneDockerBuildCache()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Failed to prune Docker build cache', err)
      return failure('UNKNOWN_ERROR', tk('docker.ipc.error.prune_cache'))
    }
  })
}
