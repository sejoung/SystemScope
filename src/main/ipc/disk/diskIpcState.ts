import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { MAX_TRASH_TARGETS } from '@shared/constants/thresholds'
import type { getExtensionBreakdown } from '@main/services/disk'
import type { DiskScanResult, DuplicateGroup, LargeFile } from '@shared/types'
import { registerShellPath } from '@main/services/devtools'

const SCAN_CACHE_TTL_MS = 30 * 60 * 1000 // 30분
const TRASH_TARGET_TTL_MS = 60 * 60 * 1000 // 1시간
const MAX_SCAN_CACHE_ENTRIES = 5

interface ScanCacheEntry {
  result: DiskScanResult
  timestamp: number
  derivedLargeFiles: LargeFile[] | null
  derivedExtensionBreakdown: ReturnType<typeof getExtensionBreakdown> | null
}

const scanCacheMap = new Map<string, ScanCacheEntry>()
const registeredTrashTargets = new Map<string, { path: string; rootPath: string; scope: 'large' | 'old' | 'duplicate'; createdAt: number }>()

export function getScanCache(folderPath: string): ScanCacheEntry | null {
  const entry = scanCacheMap.get(path.resolve(folderPath))
  if (!entry) return null
  if ((Date.now() - entry.timestamp) >= SCAN_CACHE_TTL_MS) {
    scanCacheMap.delete(folderPath)
    return null
  }
  return entry
}

export function setScanCache(result: DiskScanResult): void {
  const resolved = path.resolve(result.rootPath)
  scanCacheMap.set(resolved, {
    result,
    timestamp: Date.now(),
    derivedLargeFiles: result.topLargeFiles ?? null,
    derivedExtensionBreakdown: result.extensionBreakdown ?? null
  })
  // 캐시 크기 제한
  while (scanCacheMap.size > MAX_SCAN_CACHE_ENTRIES) {
    const firstKey = scanCacheMap.keys().next().value
    if (firstKey !== undefined) scanCacheMap.delete(firstKey)
    else break
  }
  registerShellPath(result.rootPath)
}

function clearTrashTargetsForScope(rootPath: string, scope: 'large' | 'old' | 'duplicate'): void {
  for (const [itemId, target] of registeredTrashTargets) {
    if (target.rootPath === rootPath && target.scope === scope) {
      registeredTrashTargets.delete(itemId)
    }
  }
}

export function clearTrashTargetsForRootPath(rootPath: string): void {
  const resolvedRootPath = path.resolve(rootPath)
  for (const [itemId, target] of registeredTrashTargets) {
    if (target.rootPath === resolvedRootPath) {
      registeredTrashTargets.delete(itemId)
    }
  }
}

/** 만료 항목 정리 후, 최대 등록 수 초과 시 가장 오래된 항목 제거 */
function enforceTrashTargetLimit(): void {
  const now = Date.now()
  for (const [itemId, target] of registeredTrashTargets) {
    if ((now - target.createdAt) > TRASH_TARGET_TTL_MS) {
      registeredTrashTargets.delete(itemId)
    }
  }
  while (registeredTrashTargets.size > MAX_TRASH_TARGETS) {
    const firstKey = registeredTrashTargets.keys().next().value
    if (firstKey !== undefined) registeredTrashTargets.delete(firstKey)
    else break
  }
}

export function registerLargeFileTrashTargets(
  files: LargeFile[],
  rootPath: string,
  scope: 'large' | 'old'
): LargeFile[] {
  const resolvedRootPath = path.resolve(rootPath)
  clearTrashTargetsForScope(resolvedRootPath, scope)
  const now = Date.now()
  const result = files.map((file) => {
    const deletionKey = randomUUID()
    registeredTrashTargets.set(deletionKey, { path: file.path, rootPath: resolvedRootPath, scope, createdAt: now })
    return { ...file, deletionKey }
  })
  enforceTrashTargetLimit()
  return result
}

export function registerDuplicateTrashTargets(groups: DuplicateGroup[], rootPath: string): DuplicateGroup[] {
  const resolvedRootPath = path.resolve(rootPath)
  clearTrashTargetsForScope(resolvedRootPath, 'duplicate')
  const now = Date.now()
  const result = groups.map((group) => ({
    ...group,
    files: group.files.map((file, index) => {
      if (index === 0) {
        return file
      }

      const deletionKey = randomUUID()
      registeredTrashTargets.set(deletionKey, { path: file.path, rootPath: resolvedRootPath, scope: 'duplicate', createdAt: now })
      return { ...file, deletionKey }
    })
  }))
  enforceTrashTargetLimit()
  return result
}

export function invalidateScanCache(rootPath: string): void { scanCacheMap.delete(path.resolve(rootPath)); clearTrashTargetsForRootPath(rootPath) }
export function resolveTrashTargets(itemIds: string[]): Array<{ path: string; rootPath: string; scope: 'large' | 'old' | 'duplicate'; createdAt: number }> | null {
  enforceTrashTargetLimit()
  const targets = itemIds.map((itemId) => registeredTrashTargets.get(itemId))
  return targets.some((target) => !target) ? null : targets.filter((target): target is NonNullable<typeof target> => Boolean(target))
}

export function removeTrashedTargets(paths: string[]): void {
  const resolved = new Set(paths.map((targetPath) => path.resolve(targetPath)))
  for (const [itemId, target] of registeredTrashTargets) {
    if (resolved.has(path.resolve(target.path))) registeredTrashTargets.delete(itemId)
  }
}
