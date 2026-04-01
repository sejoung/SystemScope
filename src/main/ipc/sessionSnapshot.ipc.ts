import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import { saveSessionSnapshot, getSessionSnapshots, deleteSessionSnapshot, getSessionSnapshotDiff } from '../services/sessionSnapshotStore'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerSessionSnapshotIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SNAPSHOT_SAVE, async (_event, label?: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const snapshot = await saveSessionSnapshot(label ?? undefined)
      logInfoAction('snapshot-ipc', 'snapshot.save', withRequestMeta(requestMeta, { id: snapshot.id }))
      return success(snapshot)
    } catch (err) {
      logErrorAction('snapshot-ipc', 'snapshot.save', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to save session snapshot')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SNAPSHOT_GET_ALL, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const snapshots = await getSessionSnapshots()
      logInfoAction('snapshot-ipc', 'snapshot.getAll', withRequestMeta(requestMeta, { count: snapshots.length }))
      return success(snapshots)
    } catch (err) {
      logErrorAction('snapshot-ipc', 'snapshot.getAll', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get session snapshots')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SNAPSHOT_DELETE, async (_event, id: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      if (!id || typeof id !== 'string') {
        return failure('INVALID_INPUT', 'Snapshot ID is required')
      }
      const deleted = await deleteSessionSnapshot(id)
      logInfoAction('snapshot-ipc', 'snapshot.delete', withRequestMeta(requestMeta, { id, deleted }))
      return success(deleted)
    } catch (err) {
      logErrorAction('snapshot-ipc', 'snapshot.delete', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to delete session snapshot')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SNAPSHOT_DIFF, async (_event, id1: string, id2: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      if (!id1 || !id2 || typeof id1 !== 'string' || typeof id2 !== 'string') {
        return failure('INVALID_INPUT', 'Two snapshot IDs are required')
      }
      const diff = await getSessionSnapshotDiff(id1, id2)
      if (!diff) {
        return failure('INVALID_INPUT', 'One or both snapshots not found')
      }
      logInfoAction('snapshot-ipc', 'snapshot.diff', withRequestMeta(requestMeta, { id1, id2 }))
      return success(diff)
    } catch (err) {
      logErrorAction('snapshot-ipc', 'snapshot.diff', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to compute snapshot diff')
    }
  })
}
