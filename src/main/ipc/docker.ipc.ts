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

export function registerDockerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DOCKER_LIST_IMAGES, async () => {
    try {
      const result = await listDockerImages()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Docker 이미지 조회 실패', err)
      return failure('SCAN_FAILED', 'Docker 이미지를 조회할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_LIST_CONTAINERS, async () => {
    try {
      const result = await listDockerContainers()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Docker 컨테이너 조회 실패', err)
      return failure('SCAN_FAILED', 'Docker 컨테이너를 조회할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_LIST_VOLUMES, async () => {
    try {
      const result = await listDockerVolumes()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Docker 볼륨 조회 실패', err)
      return failure('SCAN_FAILED', 'Docker 볼륨을 조회할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_GET_BUILD_CACHE, async () => {
    try {
      const result = await getDockerBuildCache()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Docker build cache 조회 실패', err)
      return failure('SCAN_FAILED', 'Docker build cache를 조회할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_REMOVE_IMAGES, async (_event, imageIds: string[]) => {
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
        buttons: ['취소', '삭제'],
        defaultId: 0,
        cancelId: 0,
        title: 'Docker 이미지 삭제',
        message: `${targets.length}개의 Docker 이미지를 삭제하시겠습니까?`,
        detail: [
          ...targets.slice(0, 5).map((image) => `- ${image.repository}:${image.tag} (${image.sizeLabel})`),
          targets.length > 5 ? `- ... 외 ${targets.length - 5}개` : null,
          '',
          `총 크기: ${formatBytes(totalSize)}`,
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
      logError('docker-ipc', 'Docker 이미지 삭제 실패', err)
      return failure('UNKNOWN_ERROR', 'Docker 이미지를 삭제할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_REMOVE_CONTAINERS, async (_event, containerIds: string[]) => {
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
        buttons: ['취소', '삭제'],
        defaultId: 0,
        cancelId: 0,
        title: 'Docker 컨테이너 삭제',
        message: `${targets.length}개의 Docker 컨테이너를 삭제하시겠습니까?`,
        detail: [
          ...targets.slice(0, 5).map((container) => `- ${container.name} (${container.image})`),
          targets.length > 5 ? `- ... 외 ${targets.length - 5}개` : null,
          '',
          `총 크기: ${formatBytes(totalSize)}`,
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
      logError('docker-ipc', 'Docker 컨테이너 삭제 실패', err)
      return failure('UNKNOWN_ERROR', 'Docker 컨테이너를 삭제할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_STOP_CONTAINERS, async (_event, containerIds: string[]) => {
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
        buttons: ['취소', '중지'],
        defaultId: 0,
        cancelId: 0,
        title: 'Docker 컨테이너 중지',
        message: `${targets.length}개의 Docker 컨테이너를 중지하시겠습니까?`,
        detail: [
          ...targets.slice(0, 5).map((container) => `- ${container.name} (${container.image})`),
          targets.length > 5 ? `- ... 외 ${targets.length - 5}개` : null,
          '',
          '중지 후 컨테이너 탭에서 삭제하거나 이미지 탭에서 참조 이미지를 정리할 수 있습니다.'
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
      logError('docker-ipc', 'Docker 컨테이너 중지 실패', err)
      return failure('UNKNOWN_ERROR', 'Docker 컨테이너를 중지할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_REMOVE_VOLUMES, async (_event, volumeNames: string[]) => {
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
        buttons: ['취소', '삭제'],
        defaultId: 0,
        cancelId: 0,
        title: 'Docker 볼륨 삭제',
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
      logError('docker-ipc', 'Docker 볼륨 삭제 실패', err)
      return failure('UNKNOWN_ERROR', 'Docker 볼륨을 삭제할 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_PRUNE_BUILD_CACHE, async () => {
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
        buttons: ['취소', '정리'],
        defaultId: 0,
        cancelId: 0,
        title: 'Docker Build Cache 정리',
        message: 'Docker build cache를 정리하시겠습니까?',
        detail: `현재 회수 가능 용량: ${cache.summary?.reclaimableLabel ?? '0 B'}`
      })

      if (confirm.response === 0) {
        return success({ reclaimedBytes: 0, reclaimedLabel: '0 B', cancelled: true })
      }

      const result = await pruneDockerBuildCache()
      return success(result)
    } catch (err) {
      logError('docker-ipc', 'Docker build cache 정리 실패', err)
      return failure('UNKNOWN_ERROR', 'Docker build cache를 정리할 수 없습니다.')
    }
  })
}
