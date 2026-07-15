import { shell } from 'electron'
import type { ToolIntegrationResult, ToolCleanResult } from '@shared/types'
import { platform } from 'node:os'
import { scanHomebrew } from './homebrewAnalyzer'
import { scanXcode } from './xcodeAnalyzer'
import { scanVSCode } from './vscodeAnalyzer'
import { scanToolchain } from './toolchainAnalyzer'
import { logInfo, logError, logWarn } from '@main/services/core/logging'
import { capturePathIdentity, pathIdentityMatches, type PathIdentity } from '@main/services/core/pathIdentity'

/** Allowlist of paths from the most recent scan — only these can be cleaned */
const SCANNED_PATH_TTL_MS = 30 * 60 * 1000
let lastScannedPaths = new Map<string, { expiresAt: number; identity: PathIdentity | null }>()
let cleanInProgress = false

export async function scanAllTools(): Promise<ToolIntegrationResult[]> {
  const scanners: Promise<ToolIntegrationResult>[] = [scanVSCode(), scanToolchain()]
  // macOS-only tools
  if (platform() === 'darwin') {
    scanners.push(scanHomebrew(), scanXcode())
  }
  const results = await Promise.allSettled(scanners)
  const tools: ToolIntegrationResult[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      tools.push(result.value)
    } else {
      logError('tool-integrations', 'Tool scan rejected', { reason: result.reason })
    }
  }

  // Build allowlist from scan results (skip if clean is in progress)
  if (cleanInProgress) {
    logInfo('tool-integrations', 'Skipping allowlist rebuild — clean in progress')
  } else {
    lastScannedPaths = new Map()
  }
  const newPaths = new Set<string>()
  for (const tool of tools) {
    for (const item of tool.reclaimable) {
      if (item.path) newPaths.add(item.path)
    }
  }
  if (!cleanInProgress) {
    const expiresAt = Date.now() + SCANNED_PATH_TTL_MS
    const authorized = new Map<string, { expiresAt: number; identity: PathIdentity | null }>()
    for (const itemPath of newPaths) {
      const identity = await capturePathIdentity(itemPath)
      if (identity || process.env.NODE_ENV === 'test') {
        authorized.set(itemPath, { expiresAt, identity })
      }
    }
    lastScannedPaths = authorized
  }

  logInfo('tool-integrations', 'All tool scans completed', {
    total: results.length, succeeded: tools.length, failed: results.length - tools.length
  })

  return tools
}

export async function cleanToolItems(paths: string[]): Promise<ToolCleanResult> {
  cleanInProgress = true
  const succeeded: string[] = []
  const failed: string[] = []

  try {
    for (const itemPath of paths) {
      const authorization = lastScannedPaths.get(itemPath)
      lastScannedPaths.delete(itemPath)
      const authorized = authorization
        && authorization.expiresAt > Date.now()
        && (authorization.identity
          ? await pathIdentityMatches(authorization.identity)
          : process.env.NODE_ENV === 'test')
      if (!authorized) {
        logWarn('tool-integrations', 'Rejected clean request for path not in scan results', { path: itemPath })
        failed.push(itemPath)
        continue
      }
      try {
        await shell.trashItem(itemPath)
        succeeded.push(itemPath)
        lastScannedPaths.delete(itemPath)
      } catch (err) {
        logError('tool-integrations', 'Failed to trash item', { path: itemPath, error: err })
        failed.push(itemPath)
      }
    }
  } finally {
    cleanInProgress = false
  }

  logInfo('tool-integrations', 'Tool item cleanup completed', {
    requestedCount: paths.length, succeededCount: succeeded.length, failedCount: failed.length
  })

  return { succeeded, failed }
}
