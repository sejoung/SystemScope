import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { platform, homedir } from 'node:os'
import { shell } from 'electron'
import type {
  CleanupRule,
  CleanupRuleId,
  CleanupRuleConfig,
  CleanupPreview,
  CleanupPreviewItem,
  CleanupResult
} from '@shared/types'
import { getSettings, setSettings } from '../store/settingsStore'
import { listDockerContainers } from './dockerImages'
import { recordEvent } from './eventStore'
import { logInfo, logWarn } from './logging'

const home = homedir()
const isMac = platform() === 'darwin'

const BUILT_IN_RULES: Omit<CleanupRule, 'enabled' | 'minAgeDays'>[] = [
  {
    id: 'downloads_old_files',
    name: 'Old Downloads',
    description: 'Files in Downloads folder older than the configured threshold',
    category: 'downloads',
    targetPaths: [path.join(home, 'Downloads')]
  },
  {
    id: 'xcode_derived_data',
    name: 'Xcode DerivedData',
    description: 'Xcode build cache that can be safely regenerated',
    category: 'dev_tools',
    targetPaths: isMac ? [path.join(home, 'Library/Developer/Xcode/DerivedData')] : []
  },
  {
    id: 'xcode_archives',
    name: 'Xcode Archives',
    description: 'Old Xcode archive builds',
    category: 'dev_tools',
    targetPaths: isMac ? [path.join(home, 'Library/Developer/Xcode/Archives')] : []
  },
  {
    id: 'npm_cache',
    name: 'npm Cache',
    description: 'npm package download cache',
    category: 'package_managers',
    targetPaths: [path.join(home, isMac ? '.npm/_cacache' : 'AppData/Local/npm-cache/_cacache')]
  },
  {
    id: 'pnpm_cache',
    name: 'pnpm Cache',
    description: 'pnpm content-addressable store cache',
    category: 'package_managers',
    targetPaths: [path.join(home, isMac ? 'Library/pnpm/store' : 'AppData/Local/pnpm/store')]
  },
  {
    id: 'yarn_cache',
    name: 'Yarn Cache',
    description: 'Yarn package cache',
    category: 'package_managers',
    targetPaths: [path.join(home, isMac ? 'Library/Caches/Yarn' : 'AppData/Local/Yarn/Cache')]
  },
  {
    id: 'docker_stopped_containers',
    name: 'Docker Stopped Containers',
    description: 'Docker containers that are no longer running',
    category: 'docker',
    targetPaths: [] // handled via Docker CLI, not filesystem
  },
  {
    id: 'old_logs',
    name: 'Old Log Files',
    description: 'System and application log files',
    category: 'system',
    targetPaths: isMac ? [path.join(home, 'Library/Logs')] : [path.join(home, 'AppData/Local/Temp')]
  },
  {
    id: 'temp_files',
    name: 'Temporary Files',
    description: 'Temporary files and caches',
    category: 'system',
    targetPaths: isMac ? [path.join(home, 'Library/Caches')] : [path.join(home, 'AppData/Local/Temp')]
  }
]

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Merge BUILT_IN_RULES with user config from settings.automation.rules.
 * Returns full CleanupRule objects with enabled/minAgeDays from config.
 */
export function getCleanupRules(): CleanupRule[] {
  const settings = getSettings()
  const userConfigs = settings.automation.rules

  const configMap = new Map<CleanupRuleId, CleanupRuleConfig>()
  for (const config of userConfigs) {
    configMap.set(config.id, config)
  }

  return BUILT_IN_RULES.map((rule) => {
    const config = configMap.get(rule.id)
    return {
      ...rule,
      enabled: config?.enabled ?? true,
      minAgeDays: config?.minAgeDays ?? 30
    }
  })
}

/**
 * Update a single rule's config in settings.
 */
export function setCleanupRuleConfig(config: CleanupRuleConfig): void {
  const settings = getSettings()
  const rules = [...settings.automation.rules]

  const existingIndex = rules.findIndex((r) => r.id === config.id)
  if (existingIndex >= 0) {
    rules[existingIndex] = config
  } else {
    rules.push(config)
  }

  setSettings({
    automation: {
      ...settings.automation,
      rules
    }
  })

  logInfo('cleanup-rules', 'Rule config updated', { ruleId: config.id, enabled: config.enabled, minAgeDays: config.minAgeDays })
}

/**
 * Preview cleanup: scan enabled rules and collect eligible items.
 */
export async function previewCleanup(): Promise<CleanupPreview> {
  const rules = getCleanupRules()
  const enabledRules = rules.filter((rule) => rule.enabled)
  const allItems: CleanupPreviewItem[] = []

  for (const rule of enabledRules) {
    try {
      if (rule.id === 'docker_stopped_containers') {
        const dockerItems = await scanDockerStoppedContainers(rule)
        allItems.push(...dockerItems)
      } else {
        const fsItems = await scanFilesystemRule(rule)
        allItems.push(...fsItems)
      }
    } catch (err) {
      logWarn('cleanup-rules', `Failed to scan rule: ${rule.id}`, { error: err })
    }
  }

  // Sort by size descending
  allItems.sort((a, b) => b.size - a.size)

  // Build rule breakdown
  const breakdownMap = new Map<CleanupRuleId, { ruleName: string; itemCount: number; totalSize: number }>()
  for (const item of allItems) {
    const existing = breakdownMap.get(item.rule)
    if (existing) {
      existing.itemCount++
      existing.totalSize += item.size
    } else {
      const rule = rules.find((r) => r.id === item.rule)
      breakdownMap.set(item.rule, {
        ruleName: rule?.name ?? item.rule,
        itemCount: 1,
        totalSize: item.size
      })
    }
  }

  const ruleBreakdown = Array.from(breakdownMap.entries()).map(([ruleId, data]) => ({
    ruleId,
    ...data
  }))

  const totalSize = allItems.reduce((sum, item) => sum + item.size, 0)

  logInfo('cleanup-rules', 'Cleanup preview completed', {
    totalItems: allItems.length,
    totalSize,
    ruleCount: ruleBreakdown.length
  })

  return {
    items: allItems,
    totalSize,
    ruleBreakdown,
    scannedAt: Date.now()
  }
}

/**
 * Execute cleanup: move each path to trash.
 */
export async function executeCleanup(paths: string[]): Promise<CleanupResult> {
  let deletedCount = 0
  let deletedSize = 0
  let failedCount = 0
  const failedPaths: string[] = []

  for (const filePath of paths) {
    try {
      const stat = await fs.stat(filePath)
      const size = stat.size

      await shell.trashItem(filePath)
      deletedCount++
      deletedSize += size
    } catch (err) {
      failedCount++
      failedPaths.push(filePath)
      logWarn('cleanup-rules', 'Failed to move item to trash', { path: filePath, error: err })
    }
  }

  const result: CleanupResult = {
    deletedCount,
    deletedSize,
    failedCount,
    failedPaths,
    completedAt: Date.now()
  }

  if (deletedCount > 0) {
    void recordEvent(
      'disk_cleanup',
      'info',
      `Cleanup executed: ${deletedCount} item(s) moved to trash`,
      undefined,
      {
        deletedCount,
        deletedSize,
        failedCount
      }
    )
  }

  logInfo('cleanup-rules', 'Cleanup executed', {
    deletedCount,
    deletedSize,
    failedCount
  })

  return result
}

/**
 * Scan direct children of targetPaths for files older than minAgeDays.
 */
async function scanFilesystemRule(rule: CleanupRule): Promise<CleanupPreviewItem[]> {
  const items: CleanupPreviewItem[] = []
  const cutoffMs = Date.now() - rule.minAgeDays * MS_PER_DAY

  for (const targetPath of rule.targetPaths) {
    try {
      await fs.access(targetPath)
    } catch {
      // Path does not exist or is inaccessible — skip
      continue
    }

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(targetPath, entry.name)
        try {
          const stat = await fs.stat(fullPath)
          const modifiedAt = stat.mtimeMs

          if (modifiedAt < cutoffMs) {
            items.push({
              path: fullPath,
              size: stat.isDirectory() ? 0 : stat.size,
              modifiedAt,
              rule: rule.id
            })
          }
        } catch {
          // Permission error or broken symlink — skip gracefully
        }
      }
    } catch (err) {
      logWarn('cleanup-rules', `Failed to read directory for rule ${rule.id}`, { path: targetPath, error: err })
    }
  }

  return items
}

/**
 * Scan Docker for stopped containers via the Docker CLI.
 * If Docker is unavailable, returns an empty array gracefully.
 */
async function scanDockerStoppedContainers(rule: CleanupRule): Promise<CleanupPreviewItem[]> {
  try {
    const result = await listDockerContainers()

    if (result.status !== 'ready') {
      logInfo('cleanup-rules', 'Docker not available for cleanup scan', { status: result.status })
      return []
    }

    const stoppedContainers = result.containers.filter((c) => !c.running)
    return stoppedContainers.map((container) => ({
      path: `docker:container:${container.id}`,
      size: container.sizeBytes,
      modifiedAt: 0, // Docker containers don't have a direct mtime
      rule: rule.id
    }))
  } catch (err) {
    logWarn('cleanup-rules', 'Failed to scan Docker stopped containers', { error: err })
    return []
  }
}
