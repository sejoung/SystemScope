import { ipcMain } from './_shared/trustedIpc'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getDockerBuildCache, listDockerContainers, listDockerImages, listDockerVolumes } from '@main/services/docker'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction } from '@main/services/core'
import { tk } from '../i18n'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './_shared/requestContext'
import { registerDockerImageContainerIpc } from './dockerImageContainer.ipc'
import { registerDockerResourceMutationIpc } from './dockerResourceMutations.ipc'

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

  registerDockerImageContainerIpc()
  registerDockerResourceMutationIpc()
}
