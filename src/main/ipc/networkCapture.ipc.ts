import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import {
  clearNetworkCapture,
  getNetworkCaptureCapability,
  getNetworkCaptureStatus,
  listRecentNetworkFlows,
  startNetworkCapture,
  stopNetworkCapture
} from '../services/networkCapture'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerNetworkCaptureIpc(): void {
  ipcMain.handle(IPC_CHANNELS.NETWORK_CAPTURE_GET_CAPABILITY, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)

    try {
      const capability = getNetworkCaptureCapability()
      logInfoAction('network-capture-ipc', 'networkCapture.getCapability', withRequestMeta(requestMeta, { ...capability }))
      return success(capability)
    } catch (error) {
      logErrorAction('network-capture-ipc', 'networkCapture.getCapability', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', 'Failed to get network capture capability')
    }
  })

  ipcMain.handle(IPC_CHANNELS.NETWORK_CAPTURE_GET_STATUS, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)

    try {
      const status = getNetworkCaptureStatus()
      logInfoAction('network-capture-ipc', 'networkCapture.getStatus', withRequestMeta(requestMeta, { ...status }))
      return success(status)
    } catch (error) {
      logErrorAction('network-capture-ipc', 'networkCapture.getStatus', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', 'Failed to get network capture status')
    }
  })

  ipcMain.handle(IPC_CHANNELS.NETWORK_CAPTURE_START, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)

    try {
      const started = startNetworkCapture()
      logInfoAction('network-capture-ipc', 'networkCapture.start', withRequestMeta(requestMeta, { started }))
      return success(started)
    } catch (error) {
      logErrorAction('network-capture-ipc', 'networkCapture.start', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', 'Failed to start network capture')
    }
  })

  ipcMain.handle(IPC_CHANNELS.NETWORK_CAPTURE_STOP, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)

    try {
      const stopped = stopNetworkCapture()
      logInfoAction('network-capture-ipc', 'networkCapture.stop', withRequestMeta(requestMeta, { stopped }))
      return success(stopped)
    } catch (error) {
      logErrorAction('network-capture-ipc', 'networkCapture.stop', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', 'Failed to stop network capture')
    }
  })

  ipcMain.handle(IPC_CHANNELS.NETWORK_CAPTURE_CLEAR, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)

    try {
      const cleared = clearNetworkCapture()
      logInfoAction('network-capture-ipc', 'networkCapture.clear', withRequestMeta(requestMeta, { cleared }))
      return success(cleared)
    } catch (error) {
      logErrorAction('network-capture-ipc', 'networkCapture.clear', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', 'Failed to clear recent network flows')
    }
  })

  ipcMain.handle(IPC_CHANNELS.NETWORK_CAPTURE_LIST_RECENT, (_event, limit?: unknown, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)

    try {
      const recentFlows = listRecentNetworkFlows(typeof limit === 'number' ? limit : undefined)
      logInfoAction('network-capture-ipc', 'networkCapture.listRecent', withRequestMeta(requestMeta, { count: recentFlows.length }))
      return success(recentFlows)
    } catch (error) {
      logErrorAction('network-capture-ipc', 'networkCapture.listRecent', withRequestMeta(requestMeta, { error }))
      return failure('UNKNOWN_ERROR', 'Failed to list recent network flows')
    }
  })
}
