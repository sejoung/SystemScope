import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getDiagnosisSummary } from '../services/diagnosisAdvisor'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerDiagnosisIpc(): void {
  ipcMain.handle(IPC_CHANNELS.DIAGNOSIS_GET_SUMMARY, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const summary = await getDiagnosisSummary()
      logInfoAction('diagnosis-ipc', 'diagnosis.getSummary', withRequestMeta(requestMeta, { resultCount: summary.results.length }))
      return success(summary)
    } catch (err) {
      logErrorAction('diagnosis-ipc', 'diagnosis.getSummary', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get diagnosis summary')
    }
  })
}
