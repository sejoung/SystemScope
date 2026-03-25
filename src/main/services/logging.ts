import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import log from 'electron-log'

const LOG_RETENTION_DAYS = 10
const LOG_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
const LOG_FILE_PREFIX = 'systemscope-'
const ACCESS_LOG_FILE_PREFIX = 'systemscope-access-'
const LOG_FILE_PATTERN = /^systemscope-(\d{4})-(\d{2})-(\d{2})\.log$/
const ACCESS_LOG_FILE_PATTERN = /^systemscope-access-(\d{4})-(\d{2})-(\d{2})\.log$/

let cleanupTimer: NodeJS.Timeout | null = null
let accessLogWriteQueue: Promise<void> = Promise.resolve()

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type ProductMetricResult = 'started' | 'succeeded' | 'failed' | 'cancelled'

export function logDebug(scope: string, message: string, metadata?: unknown): void {
  writeLog('debug', scope, message, metadata)
}

export function logInfo(scope: string, message: string, metadata?: unknown): void {
  writeLog('info', scope, message, metadata)
}

export function logInfoAction(scope: string, action: string, metadata?: unknown): void {
  writeAccessLog('info', scope, formatActionMessage(action, 'success'), metadata)
}

export function logWarn(scope: string, message: string, metadata?: unknown): void {
  writeLog('warn', scope, message, metadata)
}

export function logWarnAction(scope: string, action: string, metadata?: unknown): void {
  writeAccessLog('warn', scope, formatActionMessage(action, 'rejected'), metadata)
}

export function logError(scope: string, message: string, metadata?: unknown): void {
  writeLog('error', scope, message, metadata)
}

export function logErrorAction(scope: string, action: string, metadata?: unknown): void {
  writeAccessLog('error', scope, formatActionMessage(action, 'failed'), metadata)
}

export function logProductMetric(
  scope: string,
  task: string,
  result: ProductMetricResult,
  metadata?: unknown
): void {
  const level: LogLevel = result === 'failed' ? 'error' : 'info'
  writeAccessLog(level, scope, formatProductMetricMessage(task, result), metadata)
}

export function initializeLogging(): void {
  ensureLogDir()

  log.transports.file.level = 'info'
  log.transports.console.level = 'debug'
  log.transports.console.format = '{h}:{i}:{s}.{ms} [{level}] > {text}'
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  log.transports.file.resolvePathFn = () => getLogFilePath(new Date())

  cleanupOldLogs()
  startLogCleanupScheduler()
}

export function shutdownLogging(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}

export function flushLoggingWrites(): Promise<void> {
  return accessLogWriteQueue
}

export function getLogDir(): string {
  return path.join(app.getPath('userData'), 'logs')
}

export function getSystemLogDir(): string {
  return path.join(getLogDir(), 'system')
}

export function getAccessLogDir(): string {
  return path.join(getLogDir(), 'access')
}

export function getLogFilePath(date: Date): string {
  return path.join(getSystemLogDir(), `${LOG_FILE_PREFIX}${formatDateForLogFile(date)}.log`)
}

export function getAccessLogFilePath(date: Date): string {
  return path.join(getAccessLogDir(), `${ACCESS_LOG_FILE_PREFIX}${formatDateForLogFile(date)}.log`)
}

export function formatDateForLogFile(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function cleanupOldLogs(now = new Date(), retentionDays = LOG_RETENTION_DAYS): void {
  const cutoffDate = startOfDay(new Date(now))
  cutoffDate.setDate(cutoffDate.getDate() - (retentionDays - 1))

  for (const logDir of [getSystemLogDir(), getAccessLogDir()]) {
    if (!fs.existsSync(logDir)) {
      continue
    }

    for (const fileName of fs.readdirSync(logDir)) {
      const fileDate = parseLogDateFromFileName(fileName)
      if (!fileDate || fileDate >= cutoffDate) {
        continue
      }

      const filePath = path.join(logDir, fileName)
      try {
        fs.unlinkSync(filePath)
      } catch (error) {
        logWarn('logging', 'Failed to delete old log file', { filePath, error })
      }
    }
  }
}

function ensureLogDir(): void {
  for (const logDir of [getLogDir(), getSystemLogDir(), getAccessLogDir()]) {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
  }
}

function startLogCleanupScheduler(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
  }

  cleanupTimer = setInterval(() => {
    cleanupOldLogs()
  }, LOG_CLEANUP_INTERVAL_MS)

  cleanupTimer.unref?.()
}

function parseLogDateFromFileName(fileName: string): Date | null {
  const match = LOG_FILE_PATTERN.exec(fileName) ?? ACCESS_LOG_FILE_PATTERN.exec(fileName)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))

  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null
  }

  return startOfDay(parsed)
}

function startOfDay(date: Date): Date {
  date.setHours(0, 0, 0, 0)
  return date
}

function formatActionMessage(action: string, result: 'success' | 'rejected' | 'failed'): string {
  return `action=${action} result=${result}`
}

function formatProductMetricMessage(task: string, result: ProductMetricResult): string {
  return `event=product_metric task=${task} result=${result}`
}

function writeLog(level: LogLevel, scope: string, message: string, metadata?: unknown): void {
  const formattedMessage = `[${scope}]\n${message}`
  const normalizedMetadata = normalizeLogMetadata(level, metadata)

  if (normalizedMetadata === undefined) {
    log[level](formattedMessage)
    return
  }

  log[level](formattedMessage, normalizedMetadata)
}

function writeAccessLog(level: LogLevel, scope: string, message: string, metadata?: unknown): void {
  const formattedMessage = `[${scope}]\n${message}`
  const normalizedMetadata = normalizeLogMetadata(level, metadata)
  const timestamp = formatTimestamp(new Date())
  const suffix = normalizedMetadata === undefined ? '' : ` ${safeJsonStringify(normalizedMetadata)}`
  const line = `[${timestamp}] [${level}] ${formattedMessage}${suffix}\n`

  accessLogWriteQueue = accessLogWriteQueue
    .then(() => fs.promises.appendFile(getAccessLogFilePath(new Date()), line, 'utf8'))
    .catch((error) => {
      writeLog('warn', 'logging', 'Failed to append access log entry', {
        error,
        scope,
        level
      })
    })
}

function normalizeLogMetadata(level: LogLevel, metadata: unknown): unknown {
  if (metadata === undefined) {
    return undefined
  }

  if (metadata instanceof Error) {
    return serializeError(level, metadata)
  }

  if (Array.isArray(metadata)) {
    return metadata.map((item) => normalizeLogMetadata(level, item))
  }

  if (metadata && typeof metadata === 'object') {
    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, normalizeLogMetadata(level, value)])
    )
  }

  return metadata
}

function serializeError(level: LogLevel, error: Error): Record<string, string | undefined> {
  const serialized: Record<string, string | undefined> = {
    name: error.name,
    message: error.message
  }

  if (level === 'error') {
    serialized.stack = error.stack
  }

  return serialized
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify({ error: 'Failed to serialize log metadata.' })
  }
}
