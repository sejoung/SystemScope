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
import { listDockerContainers, removeDockerContainers } from '@main/services/docker/dockerImages'
import { recordEvent } from '@main/services/history/eventStore'
import { logInfo, logWarn } from '@main/services/core/logging'
import { getDirSize } from '../../utils/getDirSize'
import { getEffectiveCleanupRules, setEffectiveCleanupRuleConfig } from '@main/services/profile/profileManager'
import { adminMoveToTrash } from '@main/services/core/adminShell.mac'

const home = homedir()
const isMac = platform() === 'darwin'

const BUILT_IN_RULES: Omit<CleanupRule, 'enabled' | 'minAgeDays'>[] = [
  {
    id: 'downloads_old_files',
    name: 'Old Downloads',
    description: 'Files in Downloads folder older than the configured threshold',
    category: 'downloads',
    safetyLevel: 'caution',
    targetPaths: [path.join(home, 'Downloads')]
  },
  {
    id: 'xcode_derived_data',
    name: 'Xcode DerivedData',
    description: 'Xcode build cache that can be safely regenerated',
    category: 'dev_tools',
    safetyLevel: 'safe',
    targetPaths: isMac ? [path.join(home, 'Library/Developer/Xcode/DerivedData')] : []
  },
  {
    id: 'xcode_archives',
    name: 'Xcode Archives',
    description: 'Old Xcode archive builds',
    category: 'dev_tools',
    safetyLevel: 'risky',
    targetPaths: isMac ? [path.join(home, 'Library/Developer/Xcode/Archives')] : []
  },
  {
    id: 'npm_cache',
    name: 'npm Cache',
    description: 'npm package download cache',
    category: 'package_managers',
    safetyLevel: 'safe',
    targetPaths: [path.join(home, isMac ? '.npm/_cacache' : 'AppData/Local/npm-cache/_cacache')]
  },
  {
    id: 'pnpm_cache',
    name: 'pnpm Cache',
    description: 'pnpm content-addressable store cache',
    category: 'package_managers',
    safetyLevel: 'safe',
    targetPaths: [path.join(home, isMac ? 'Library/pnpm/store' : 'AppData/Local/pnpm/store')]
  },
  {
    id: 'yarn_cache',
    name: 'Yarn Cache',
    description: 'Yarn package cache',
    category: 'package_managers',
    safetyLevel: 'safe',
    targetPaths: [path.join(home, isMac ? 'Library/Caches/Yarn' : 'AppData/Local/Yarn/Cache')]
  },
  {
    id: 'docker_stopped_containers',
    name: 'Docker Stopped Containers',
    description: 'Docker containers that are no longer running',
    category: 'docker',
    safetyLevel: 'safe',
    targetPaths: [] // handled via Docker CLI, not filesystem
  },
  {
    id: 'old_logs',
    name: 'Old Log Files',
    description: 'System and application log files',
    category: 'system',
    safetyLevel: 'safe',
    targetPaths: isMac ? [path.join(home, 'Library/Logs')] : [path.join(home, 'AppData/Local/Temp')]
  },
  {
    id: 'temp_files',
    name: 'Temporary Files',
    description: 'Temporary files and caches',
    category: 'system',
    safetyLevel: 'safe',
    targetPaths: isMac ? [path.join(home, 'Library/Caches')] : [path.join(home, 'AppData/Local/Temp')]
  }
]

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DOCKER_CONTAINER_PREFIX = 'docker:container:'
const PREVIEW_TARGET_TTL_MS = 30 * 60 * 1000

/**
 * Targets surfaced by recent previewCleanup() runs. executeCleanup only acts on
 * entries present here, so a compromised/buggy renderer cannot ask us to trash
 * arbitrary filesystem paths it never saw in a preview. Keep a short-lived union
 * instead of a single last-preview set so inbox refreshes or automation previews
 * do not invalidate an already-open cleanup confirmation dialog.
 */
let previewedTargets = new Map<string, number>()

/** Test-only: seed the set of targets executeCleanup is allowed to act on. */
export function __setPreviewedTargetsForTests(targets: string[]): void {
  const expiresAt = Date.now() + PREVIEW_TARGET_TTL_MS
  previewedTargets = new Map(targets.map((target) => [target, expiresAt]))
}

/**
 * Merge BUILT_IN_RULES with user config from settings.automation.rules.
 * Returns full CleanupRule objects with enabled/minAgeDays from config.
 */
export function getCleanupRules(): CleanupRule[] {
  const userConfigs = getEffectiveCleanupRules()

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
 * Update a single rule's config — written to the active profile when one is
 * active (the same place getCleanupRules reads from), otherwise to settings.
 */
export function setCleanupRuleConfig(config: CleanupRuleConfig): void {
  setEffectiveCleanupRuleConfig(config)
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

  registerPreviewedTargets(allItems.map((item) => item.path))

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
  prunePreviewedTargets()

  let deletedCount = 0
  let deletedSize = 0
  let failedCount = 0
  const failedPaths: string[] = []
  const dockerContainerIds: string[] = []
  const fileSystemPaths: string[] = []

  for (const target of paths) {
    // Containment: only act on targets that a recent preview produced.
    // Anything else (e.g. an arbitrary path injected by a compromised renderer)
    // is rejected outright instead of being trashed.
    if (!previewedTargets.has(target)) {
      failedCount++
      failedPaths.push(target)
      logWarn('cleanup-rules', 'Rejected cleanup target not present in last preview', { path: target })
      continue
    }

    const dockerContainerId = parseDockerContainerCleanupTarget(target)
    if (dockerContainerId) {
      dockerContainerIds.push(dockerContainerId)
      continue
    }
    fileSystemPaths.push(target)
  }

  if (dockerContainerIds.length > 0) {
    const sizeByContainerId = await getDockerContainerSizeMap(dockerContainerIds)
    const dockerResult = await removeDockerContainers(dockerContainerIds)

    deletedCount += dockerResult.deletedIds.length
    deletedSize += dockerResult.deletedIds.reduce((sum, id) => sum + (sizeByContainerId.get(id) ?? 0), 0)

    const deletedIdSet = new Set(dockerResult.deletedIds)
    for (const id of dockerContainerIds) {
      if (!deletedIdSet.has(id)) {
        failedCount++
        failedPaths.push(toDockerContainerCleanupTarget(id))
      }
    }
  }

  // Items trashItem couldn't move although they still exist — typically root-owned
  // dirs an installer left in the user's home (e.g. ~/Library/Logs/Wondershare).
  const adminRetry: Array<{ path: string; size: number }> = []

  for (const filePath of fileSystemPaths) {
    let size = 0
    try {
      const stat = await fs.stat(filePath)
      size = stat.isDirectory() ? await getDirSize(filePath) : stat.size

      await shell.trashItem(filePath)
      deletedCount++
      deletedSize += size
    } catch (err) {
      const stillPresent = await fs.lstat(filePath).then(() => true).catch(() => false)
      if (isMac && stillPresent) {
        adminRetry.push({ path: filePath, size })
        logWarn('cleanup-rules', 'Trash failed, will retry with administrator privileges', { path: filePath, error: err })
      } else {
        failedCount++
        failedPaths.push(filePath)
        logWarn('cleanup-rules', 'Failed to move item to trash', { path: filePath, error: err })
      }
    }
  }

  if (adminRetry.length > 0) {
    // One macOS password prompt for the whole batch.
    const { moved, failed } = await adminMoveToTrash(adminRetry.map((i) => i.path))
    const sizeByPath = new Map(adminRetry.map((i) => [i.path, i.size]))
    for (const movedPath of moved) {
      deletedCount++
      deletedSize += sizeByPath.get(movedPath) ?? 0
    }
    for (const failedPath of failed) {
      failedCount++
      failedPaths.push(failedPath)
      logWarn('cleanup-rules', 'Failed to move item to trash even with administrator privileges', { path: failedPath })
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

function registerPreviewedTargets(targets: string[]): void {
  prunePreviewedTargets()
  const expiresAt = Date.now() + PREVIEW_TARGET_TTL_MS
  for (const target of targets) {
    previewedTargets.set(target, expiresAt)
  }
}

function prunePreviewedTargets(): void {
  const now = Date.now()
  for (const [target, expiresAt] of previewedTargets) {
    if (expiresAt <= now) {
      previewedTargets.delete(target)
    }
  }
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
            const size = stat.isDirectory() ? await getDirSize(fullPath) : stat.size
            items.push({
              path: fullPath,
              size,
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
      path: toDockerContainerCleanupTarget(container.id),
      size: container.sizeBytes,
      modifiedAt: 0, // Docker containers don't have a direct mtime
      rule: rule.id
    }))
  } catch (err) {
    logWarn('cleanup-rules', 'Failed to scan Docker stopped containers', { error: err })
    return []
  }
}

async function getDockerContainerSizeMap(containerIds: string[]): Promise<Map<string, number>> {
  const result = await listDockerContainers()
  if (result.status !== 'ready') {
    return new Map()
  }

  const targetIds = new Set(containerIds)
  return new Map(
    result.containers
      .filter((container) => targetIds.has(container.id))
      .map((container) => [container.id, container.sizeBytes] as const)
  )
}

function parseDockerContainerCleanupTarget(value: string): string | null {
  return value.startsWith(DOCKER_CONTAINER_PREFIX) ? value.slice(DOCKER_CONTAINER_PREFIX.length) : null
}

function toDockerContainerCleanupTarget(containerId: string): string {
  return `${DOCKER_CONTAINER_PREFIX}${containerId}`
}
