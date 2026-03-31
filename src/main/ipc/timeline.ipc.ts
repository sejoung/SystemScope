import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getTimelineData, getPointDetail } from '../services/metricsStore'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction, logWarnAction } from '../services/logging'
import { tk } from '../i18n'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'
import type { TimelineRange } from '@shared/types/metric'

const VALID_RANGES = new Set<TimelineRange>(['24h', '7d', '30d'])

export function registerTimelineIpc(): void {
  ipcMain.handle(IPC_CHANNELS.TIMELINE_GET_DATA, async (_event, range: unknown, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (typeof range !== 'string' || !VALID_RANGES.has(range as TimelineRange)) {
      logWarnAction('timeline-ipc', 'timeline.getData', withRequestMeta(requestMeta, { range, reason: 'invalid_input' }))
      return failure('INVALID_INPUT', tk('main.timeline.error.invalid_range'))
    }
    try {
      const data = await getTimelineData(range as TimelineRange)
      logInfoAction('timeline-ipc', 'timeline.getData', withRequestMeta(requestMeta, { range, pointCount: data.points.length }))
      return success(data)
    } catch (err) {
      logErrorAction('timeline-ipc', 'timeline.getData', withRequestMeta(requestMeta, { range, error: err }))
      return failure('UNKNOWN_ERROR', tk('main.timeline.error.fetch'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.TIMELINE_GET_POINT_DETAIL, async (_event, timestamp: unknown, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
      logWarnAction('timeline-ipc', 'timeline.getPointDetail', withRequestMeta(requestMeta, { timestamp, reason: 'invalid_input' }))
      return failure('INVALID_INPUT', tk('main.timeline.error.invalid_timestamp'))
    }
    try {
      const detail = await getPointDetail(timestamp)
      if (!detail) {
        logInfoAction('timeline-ipc', 'timeline.getPointDetail', withRequestMeta(requestMeta, { timestamp, found: false }))
        return success(null)
      }
      logInfoAction('timeline-ipc', 'timeline.getPointDetail', withRequestMeta(requestMeta, { timestamp, found: true }))
      return success(detail)
    } catch (err) {
      logErrorAction('timeline-ipc', 'timeline.getPointDetail', withRequestMeta(requestMeta, { timestamp, error: err }))
      return failure('UNKNOWN_ERROR', tk('main.timeline.error.fetch'))
    }
  })
}
