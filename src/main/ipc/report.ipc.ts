import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import type { ReportOptions, SaveReportOptions } from '@shared/types'
import { buildDiagnosticReport, saveDiagnosticReport } from '../services/reportBuilder'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

function isReportOptions(value: unknown): value is ReportOptions {
  if (!value || typeof value !== 'object') return false
  const opts = value as Record<string, unknown>
  return (
    typeof opts.maskSensitivePaths === 'boolean' &&
    !!opts.sections &&
    typeof opts.sections === 'object'
  )
}

function isSaveReportOptions(value: unknown): value is SaveReportOptions {
  if (!value || typeof value !== 'object') return false
  const opts = value as Record<string, unknown>
  return (
    (opts.format === 'markdown' || opts.format === 'json') &&
    !!opts.report &&
    typeof opts.report === 'object'
  )
}

export function registerReportIpc(): void {
  ipcMain.handle(IPC_CHANNELS.REPORT_BUILD, async (_event, options: unknown, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isReportOptions(options)) {
      return failure('INVALID_INPUT', 'Invalid report options')
    }
    try {
      const report = await buildDiagnosticReport(options)
      logInfoAction('report-ipc', 'report.build', withRequestMeta(requestMeta, { sectionCount: report.sections.length }))
      return success(report)
    } catch (err) {
      logErrorAction('report-ipc', 'report.build', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to build diagnostic report')
    }
  })

  ipcMain.handle(IPC_CHANNELS.REPORT_SAVE, async (_event, options: unknown, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isSaveReportOptions(options)) {
      return failure('INVALID_INPUT', 'Invalid save report options')
    }
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
