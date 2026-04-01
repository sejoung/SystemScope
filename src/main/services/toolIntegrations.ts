import { shell } from 'electron'
import type { ToolIntegrationResult, ToolCleanResult } from '@shared/types'
import { platform } from 'node:os'
import { scanHomebrew } from './homebrewAnalyzer'
import { scanXcode } from './xcodeAnalyzer'
import { scanVSCode } from './vscodeAnalyzer'
import { scanToolchain } from './toolchainAnalyzer'
import { logInfo, logError, logWarn } from './logging'

/** Allowlist of paths from the most recent scan — only these can be cleaned */
let lastScannedPaths = new Set<string>()

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

  // Build allowlist from scan results
  lastScannedPaths = new Set<string>()
  for (const tool of tools) {
    for (const item of tool.reclaimable) {
      if (item.path) lastScannedPaths.add(item.path)
    }
  }

  logInfo('tool-integrations', 'All tool scans completed', {
    total: results.length, succeeded: tools.length, failed: results.length - tools.length
  })

  return tools
}

export async function cleanToolItems(paths: string[]): Promise<ToolCleanResult> {
  const succeeded: string[] = []
  const failed: string[] = []

  for (const itemPath of paths) {
    if (!lastScannedPaths.has(itemPath)) {
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

  logInfo('tool-integrations', 'Tool item cleanup completed', {
    requestedCount: paths.length, succeededCount: succeeded.length, failedCount: failed.length
  })

  return { succeeded, failed }
}
