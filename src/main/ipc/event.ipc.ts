import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import type { EventQueryOptions } from '@shared/types'
import { getEventHistory, getRecentEvents } from '../services/eventStore'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerEventIpc(): void {
  ipcMain.handle(IPC_CHANNELS.EVENT_GET_HISTORY, async (_event, options?: EventQueryOptions, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const events = await getEventHistory(options ?? undefined)
      logInfoAction('event-ipc', 'history.get', withRequestMeta(requestMeta, { count: events.length }))
      return success(events)
    } catch (err) {
      logErrorAction('event-ipc', 'history.get', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get event history')
    }
  })

  ipcMain.handle(IPC_CHANNELS.EVENT_GET_RECENT, async (_event, count?: number, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const events = await getRecentEvents(count ?? undefined)
      logInfoAction('event-ipc', 'recent.get', withRequestMeta(requestMeta, { count: events.length }))
      return success(events)
    } catch (err) {
      logErrorAction('event-ipc', 'recent.get', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get recent events')
    }
  })
}
