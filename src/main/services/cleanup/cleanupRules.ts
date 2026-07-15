import * as fs from 'node:fs/promises'
import { platform } from 'node:os'
import { shell } from 'electron'
import type {
  CleanupRule,
  CleanupRuleId,
  CleanupRuleConfig,
  CleanupPreview,
  CleanupPreviewItem,
  CleanupResult
} from '@shared/types'
import { removeDockerContainers } from '@main/services/docker/dockerImages'
import { recordEvent } from '@main/services/history/eventStore'
import { logInfo, logWarn } from '@main/services/core/logging'
import { getDirSize } from '../../utils/getDirSize'
import { getEffectiveCleanupRules, setEffectiveCleanupRuleConfig } from '@main/services/profile/profileManager'
import { adminMoveToTrash } from '@main/services/core/adminShell.mac'
import { capturePathIdentity, pathIdentityMatches, type PathIdentity } from '@main/services/core/pathIdentity'
import { BUILT_IN_RULES } from './cleanupRuleCatalog'
import { DOCKER_CONTAINER_PREFIX, getDockerContainerSizeMap, parseDockerContainerCleanupTarget, scanDockerStoppedContainers, scanFilesystemRule, toDockerContainerCleanupTarget } from './cleanupScanners'

const isMac = platform() === 'darwin'
const PREVIEW_TARGET_TTL_MS = 30 * 60 * 1000

/**
 * Targets surfaced by recent previewCleanup() runs. executeCleanup only acts on
 * entries present here, so a compromised/buggy renderer cannot ask us to trash
 * arbitrary filesystem paths it never saw in a preview. Keep a short-lived union
 * instead of a single last-preview set so inbox refreshes or automation previews
 * do not invalidate an already-open cleanup confirmation dialog.
 */
interface PreviewedTarget {
  expiresAt: number
  kind: 'docker' | 'filesystem'
  identity: PathIdentity | null
}

let previewedTargets = new Map<string, PreviewedTarget>()

/** Test-only: seed the set of targets executeCleanup is allowed to act on. */
export function __setPreviewedTargetsForTests(targets: string[]): void {
  const expiresAt = Date.now() + PREVIEW_TARGET_TTL_MS
  previewedTargets = new Map(targets.map((target) => [target, {
    expiresAt,
    kind: target.startsWith(DOCKER_CONTAINER_PREFIX) ? 'docker' : 'filesystem',
    identity: null
  }]))
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

  await registerPreviewedTargets(allItems.map((item) => item.path))

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
    const authorization = previewedTargets.get(target)
    if (!authorization) {
      failedCount++
      failedPaths.push(target)
      logWarn('cleanup-rules', 'Rejected cleanup target not present in last preview', { path: target })
      continue
    }

    previewedTargets.delete(target)

    const dockerContainerId = parseDockerContainerCleanupTarget(target)
    if (dockerContainerId) {
      if (authorization.kind !== 'docker') {
        failedCount++
        failedPaths.push(target)
        continue
      }
      dockerContainerIds.push(dockerContainerId)
      continue
    }

    const identityMatches = authorization.kind === 'filesystem'
      && (authorization.identity
        ? await pathIdentityMatches(authorization.identity)
        : process.env.NODE_ENV === 'test')
    if (!identityMatches) {
      failedCount++
      failedPaths.push(target)
      logWarn('cleanup-rules', 'Rejected cleanup target because it changed after preview', { path: target })
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

async function registerPreviewedTargets(targets: string[]): Promise<void> {
  prunePreviewedTargets()
  const expiresAt = Date.now() + PREVIEW_TARGET_TTL_MS
  for (const target of targets) {
    const dockerId = parseDockerContainerCleanupTarget(target)
    const identity = dockerId ? null : await capturePathIdentity(target)
    if (dockerId || identity || process.env.NODE_ENV === 'test') {
      previewedTargets.set(target, {
        expiresAt,
        kind: dockerId ? 'docker' : 'filesystem',
        identity
      })
    }
  }
}

function prunePreviewedTargets(): void {
  const now = Date.now()
  for (const [target, authorization] of previewedTargets) {
    if (authorization.expiresAt <= now) {
      previewedTargets.delete(target)
    }
  }
}
