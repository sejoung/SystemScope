import { ipcMain } from './_shared/trustedIpc'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getDiagnosisSummary } from '@main/services/diagnosis'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction } from '@main/services/core'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './_shared/requestContext'

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
