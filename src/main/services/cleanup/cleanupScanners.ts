import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { CleanupPreviewItem, CleanupRule } from '@shared/types'
import { listDockerContainers } from '@main/services/docker/dockerImages'
import { logInfo, logWarn } from '@main/services/core/logging'
import { getDirSize } from '../../utils/getDirSize'

const MS_PER_DAY = 24 * 60 * 60 * 1000
export const DOCKER_CONTAINER_PREFIX = 'docker:container:'

export async function scanFilesystemRule(rule: CleanupRule): Promise<CleanupPreviewItem[]> {
  const items: CleanupPreviewItem[] = []
  const cutoffMs = Date.now() - rule.minAgeDays * MS_PER_DAY
  for (const targetPath of rule.targetPaths) {
    try { await fs.access(targetPath) } catch { continue }
    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(targetPath, entry.name)
        try {
          const stat = await fs.stat(fullPath)
          if (stat.mtimeMs < cutoffMs) {
            items.push({ path: fullPath, size: stat.isDirectory() ? await getDirSize(fullPath) : stat.size, modifiedAt: stat.mtimeMs, rule: rule.id })
          }
        } catch { /* inaccessible entries are intentionally skipped */ }
      }
    } catch (error) {
      logWarn('cleanup-rules', `Failed to read directory for rule ${rule.id}`, { path: targetPath, error })
    }
  }
  return items
}

export async function scanDockerStoppedContainers(rule: CleanupRule): Promise<CleanupPreviewItem[]> {
  try {
    const result = await listDockerContainers()
    if (result.status !== 'ready') {
      logInfo('cleanup-rules', 'Docker not available for cleanup scan', { status: result.status })
      return []
    }
    return result.containers.filter((container) => !container.running).map((container) => ({
      path: toDockerContainerCleanupTarget(container.id), size: container.sizeBytes, modifiedAt: 0, rule: rule.id
    }))
  } catch (error) {
    logWarn('cleanup-rules', 'Failed to scan Docker stopped containers', { error })
    return []
  }
}

export async function getDockerContainerSizeMap(containerIds: string[]): Promise<Map<string, number>> {
  const result = await listDockerContainers()
  if (result.status !== 'ready') return new Map()
  const targetIds = new Set(containerIds)
  return new Map(result.containers.filter((container) => targetIds.has(container.id)).map((container) => [container.id, container.sizeBytes] as const))
}

export function parseDockerContainerCleanupTarget(value: string): string | null {
  return value.startsWith(DOCKER_CONTAINER_PREFIX) ? value.slice(DOCKER_CONTAINER_PREFIX.length) : null
}

export function toDockerContainerCleanupTarget(containerId: string): string {
  return `${DOCKER_CONTAINER_PREFIX}${containerId}`
}
