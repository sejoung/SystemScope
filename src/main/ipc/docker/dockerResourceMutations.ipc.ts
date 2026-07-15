import { ipcMain } from '../_shared/trustedIpc'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getDockerBuildCache, listDockerVolumes, pruneDockerBuildCache, removeDockerVolumes } from '@main/services/docker'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction } from '@main/services/core'
import { tk } from '../../i18n'
import { getRequestMeta, isValidStringArray, withRequestMeta, type IpcRequestMetaArg } from '../_shared/requestContext'
import { recordEvent } from '@main/services/history'
import { buildTargetDetailLines, getActiveWindow, showConfirmDialog } from './dockerConfirmation'

export function registerDockerResourceMutationIpc(): void {
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
      if (result.deletedIds.length > 0) {
        void recordEvent('docker_cleanup', 'info', `Removed ${result.deletedIds.length} Docker volume(s)`, undefined, {
          deletedCount: result.deletedIds.length,
          failCount: result.failCount
        })
      }
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
      if (result.reclaimedBytes > 0) {
        void recordEvent('docker_cleanup', 'info', `Pruned Docker build cache (${result.reclaimedLabel})`, undefined, {
          reclaimedBytes: result.reclaimedBytes,
          reclaimedLabel: result.reclaimedLabel
        })
      }
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
