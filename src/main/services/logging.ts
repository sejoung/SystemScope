import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import log from 'electron-log'

const LOG_RETENTION_DAYS = 10
const LOG_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
const LOG_FILE_PREFIX = 'systemscope-'
const LOG_FILE_PATTERN = /^systemscope-(\d{4})-(\d{2})-(\d{2})\.log$/

let cleanupTimer: NodeJS.Timeout | null = null

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export function logDebug(scope: string, message: string, metadata?: unknown): void {
  writeLog('debug', scope, message, metadata)
}

export function logInfo(scope: string, message: string, metadata?: unknown): void {
  writeLog('info', scope, message, metadata)
}

export function logWarn(scope: string, message: string, metadata?: unknown): void {
  writeLog('warn', scope, message, metadata)
}

export function logError(scope: string, message: string, metadata?: unknown): void {
  writeLog('error', scope, message, metadata)
}

export function initializeLogging(): void {
  ensureLogDir()

  log.transports.file.level = 'info'
  log.transports.console.level = 'debug'
  log.transports.file.resolvePathFn = () => getLogFilePath(new Date())

  cleanupOldLogs()
  startLogCleanupScheduler()
}

export function getLogDir(): string {
  return path.join(app.getPath('userData'), 'logs')
}

export function getLogFilePath(date: Date): string {
  return path.join(getLogDir(), `${LOG_FILE_PREFIX}${formatDateForLogFile(date)}.log`)
}

export function formatDateForLogFile(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function cleanupOldLogs(now = new Date(), retentionDays = LOG_RETENTION_DAYS): void {
  const logDir = getLogDir()

  if (!fs.existsSync(logDir)) {
    return
  }

  const cutoffDate = startOfDay(new Date(now))
  cutoffDate.setDate(cutoffDate.getDate() - (retentionDays - 1))

  for (const fileName of fs.readdirSync(logDir)) {
    const fileDate = parseLogDateFromFileName(fileName)
    if (!fileDate || fileDate >= cutoffDate) {
      continue
    }

    const filePath = path.join(logDir, fileName)
    try {
      fs.unlinkSync(filePath)
    } catch (error) {
      logWarn('logging', 'Failed to remove old log file', { filePath, error })
    }
  }
}

function ensureLogDir(): void {
  const logDir = getLogDir()
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
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
  const match = LOG_FILE_PATTERN.exec(fileName)
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

function writeLog(level: LogLevel, scope: string, message: string, metadata?: unknown): void {
  const formattedMessage = `[${scope}]\n${message}`
  const normalizedMetadata = normalizeLogMetadata(metadata)

  if (normalizedMetadata === undefined) {
    log[level](formattedMessage)
    return
  }

  log[level](formattedMessage, normalizedMetadata)
}

function normalizeLogMetadata(metadata: unknown): unknown {
  if (metadata === undefined) {
    return undefined
  }

  if (metadata instanceof Error) {
    return serializeError(metadata)
  }

  if (Array.isArray(metadata)) {
    return metadata.map((item) => normalizeLogMetadata(item))
  }

  if (metadata && typeof metadata === 'object') {
    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, normalizeLogMetadata(value)])
    )
  }

  return metadata
}

function serializeError(error: Error): Record<string, string | undefined> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  }
}
