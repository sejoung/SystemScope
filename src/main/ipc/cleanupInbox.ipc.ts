import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getCleanupInbox, dismissInboxItem } from '../services/cleanupInbox'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction, logWarnAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerCleanupInboxIpc(): void {
  ipcMain.handle(IPC_CHANNELS.CLEANUP_GET_INBOX, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const inbox = await getCleanupInbox()
      logInfoAction('cleanup-inbox-ipc', 'inbox.get', withRequestMeta(requestMeta, {
        itemCount: inbox.items.length,
        totalReclaimable: inbox.totalReclaimable
      }))
      return success(inbox)
    } catch (err) {
      logErrorAction('cleanup-inbox-ipc', 'inbox.get', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get cleanup inbox')
    }
  })

  ipcMain.handle(IPC_CHANNELS.CLEANUP_DISMISS_ITEM, async (_event, path: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!path || typeof path !== 'string') {
      logWarnAction('cleanup-inbox-ipc', 'inbox.dismiss', withRequestMeta(requestMeta, { path, reason: 'invalid_input' }))
      return failure('INVALID_INPUT', 'A valid path is required')
    }
    try {
      await dismissInboxItem(path)
      logInfoAction('cleanup-inbox-ipc', 'inbox.dismiss', withRequestMeta(requestMeta, { path }))
      return success(undefined)
    } catch (err) {
      logErrorAction('cleanup-inbox-ipc', 'inbox.dismiss', withRequestMeta(requestMeta, { path, error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to dismiss cleanup item')
    }
  })
}
