import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import type { CleanupRuleConfig, CleanupRuleId } from '@shared/types'
import { getCleanupRules, setCleanupRuleConfig, previewCleanup, executeCleanup } from '../services/cleanupRules'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, isValidStringArray, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

const VALID_RULE_IDS: Set<string> = new Set<string>([
  'downloads_old_files',
  'xcode_derived_data',
  'xcode_archives',
  'npm_cache',
  'pnpm_cache',
  'yarn_cache',
  'docker_stopped_containers',
  'old_logs',
  'temp_files'
])

function isValidCleanupRuleId(value: unknown): value is CleanupRuleId {
  return typeof value === 'string' && VALID_RULE_IDS.has(value)
}

function isValidCleanupRuleConfig(value: unknown): value is CleanupRuleConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Record<string, unknown>
  return (
    isValidCleanupRuleId(config.id) &&
    typeof config.enabled === 'boolean' &&
    typeof config.minAgeDays === 'number' &&
    Number.isInteger(config.minAgeDays) &&
    config.minAgeDays >= 1 &&
    config.minAgeDays <= 3650
  )
}

export function registerCleanupIpc(): void {
  ipcMain.handle(IPC_CHANNELS.CLEANUP_GET_RULES, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const rules = getCleanupRules()
      logInfoAction('cleanup-ipc', 'rules.get', withRequestMeta(requestMeta, { count: rules.length }))
      return success(rules)
    } catch (err) {
      logErrorAction('cleanup-ipc', 'rules.get', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get cleanup rules')
    }
  })

  ipcMain.handle(IPC_CHANNELS.CLEANUP_SET_RULE_CONFIG, async (_event, config: unknown, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidCleanupRuleConfig(config)) {
      return failure('INVALID_INPUT', 'Invalid cleanup rule config')
    }

    try {
      setCleanupRuleConfig(config)
      logInfoAction('cleanup-ipc', 'rule_config.set', withRequestMeta(requestMeta, { ruleId: config.id, enabled: config.enabled, minAgeDays: config.minAgeDays }))
      return success(true)
    } catch (err) {
      logErrorAction('cleanup-ipc', 'rule_config.set', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to set cleanup rule config')
    }
  })

  ipcMain.handle(IPC_CHANNELS.CLEANUP_PREVIEW, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const preview = await previewCleanup()
      logInfoAction('cleanup-ipc', 'preview.run', withRequestMeta(requestMeta, {
        totalItems: preview.items.length,
        totalSize: preview.totalSize
      }))
      return success(preview)
    } catch (err) {
      logErrorAction('cleanup-ipc', 'preview.run', withRequestMeta(requestMeta, { error: err }))
      return failure('SCAN_FAILED', 'Failed to preview cleanup')
    }
  })

  ipcMain.handle(IPC_CHANNELS.CLEANUP_EXECUTE, async (_event, paths: unknown, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidStringArray(paths)) {
      return failure('INVALID_INPUT', 'Invalid paths array')
    }

    try {
      const result = await executeCleanup(paths)
      logInfoAction('cleanup-ipc', 'execute.run', withRequestMeta(requestMeta, {
        requestedCount: paths.length,
        deletedCount: result.deletedCount,
        deletedSize: result.deletedSize,
        failedCount: result.failedCount
      }))
      return success(result)
    } catch (err) {
      logErrorAction('cleanup-ipc', 'execute.run', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to execute cleanup')
    }
  })
}
