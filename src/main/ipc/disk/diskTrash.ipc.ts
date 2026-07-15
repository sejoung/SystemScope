import { ipcMain } from '../_shared/trustedIpc'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { cancelJob } from '../../jobs/jobManager'
import { success, failure, type TrashItemsRequest } from '@shared/types'
import { logErrorAction, logInfoAction, trashItemsWithConfirm } from '@main/services/core'
import { tk } from '../../i18n'
import { getRequestMeta, isValidStringArray, withRequestMeta, type IpcRequestMetaArg } from '../_shared/requestContext'
import { recordEvent } from '@main/services/history'
import { removeTrashedTargets, resolveTrashTargets } from './diskIpcState'

export function registerDiskTrashIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DISK_TRASH_ITEMS, async (_event, request: TrashItemsRequest, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (
      !request ||
      typeof request !== 'object' ||
      !isValidStringArray(request.itemIds)
    ) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_trash_request'))
    }

    const uniqueIds = [...new Set(request.itemIds)]
    const targets = resolveTrashTargets(uniqueIds)

    if (!targets) {
      return failure('INVALID_INPUT', tk('disk.error.invalid_trash_target'))
    }
    const resolvedTargets = targets

    try {
      const result = await trashItemsWithConfirm(
        resolvedTargets.map((target) => target.path),
        request.description || tk('disk.trash.description')
      )

      if (result.trashedPaths.length > 0) { removeTrashedTargets(result.trashedPaths) }

      if (result.trashedPaths.length > 0) {
        void recordEvent('disk_cleanup', 'info', `Moved ${result.trashedPaths.length} item(s) to trash`, undefined, {
          trashedCount: result.trashedPaths.length,
          failedCount: result.failCount
        })
      }
      logInfoAction('disk-ipc', 'trash_items.run', withRequestMeta(requestMeta, {
        requestedCount: resolvedTargets.length,
        trashedCount: result.trashedPaths.length,
        failedCount: result.failCount
      }))
      return success(result)
    } catch (err) {
      logErrorAction('disk-ipc', 'trash_items.run', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('disk.error.trash_failed'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.JOB_CANCEL, (_event, jobId: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!jobId || typeof jobId !== 'string') {
      return failure('INVALID_INPUT', tk('disk.error.invalid_job_id'))
    }
    const cancelled = cancelJob(jobId)
    if (!cancelled) {
      return failure('JOB_NOT_FOUND', tk('disk.error.job_not_found'))
    }
    logInfoAction('disk-ipc', 'job.cancel', withRequestMeta(requestMeta, { jobId }))
    return success(true)
  })
}
