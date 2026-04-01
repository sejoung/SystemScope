import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import type { ReportOptions, SaveReportOptions } from '@shared/types'
import { buildDiagnosticReport, saveDiagnosticReport } from '../services/reportBuilder'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerReportIpc(): void {
  ipcMain.handle(IPC_CHANNELS.REPORT_BUILD, async (_event, options: ReportOptions, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const report = await buildDiagnosticReport(options)
      logInfoAction('report-ipc', 'report.build', withRequestMeta(requestMeta, { sectionCount: report.sections.length }))
      return success(report)
    } catch (err) {
      logErrorAction('report-ipc', 'report.build', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to build diagnostic report')
    }
  })

  ipcMain.handle(IPC_CHANNELS.REPORT_SAVE, async (_event, options: SaveReportOptions, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const filePath = await saveDiagnosticReport(options)
      logInfoAction('report-ipc', 'report.save', withRequestMeta(requestMeta, { filePath, format: options.format }))
      return success({ filePath })
    } catch (err) {
      const message = err instanceof Error && err.message === 'Save cancelled' ? 'Save cancelled' : 'Failed to save report'
      logErrorAction('report-ipc', 'report.save', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', message)
    }
  })
}
