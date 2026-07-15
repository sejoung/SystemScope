import { shell } from 'electron'
import * as fsp from 'node:fs/promises'
import { homedir, platform as getPlatform } from 'node:os'
import type { AppRelatedDataItem, InstalledApp } from '@shared/types'
import { logInfo, logWarn } from '@main/services/core/logging'
import { tk } from '../../i18n'
import { getMacRelatedDataCandidates, moveMacAppToTrashWithFinder } from './installedApps.mac'
import { getWindowsRelatedDataCandidates } from './installedApps.windows'

export async function trashPathWithFallback(targetPath: string): Promise<void> {
  try {
    await shell.trashItem(targetPath)
  } catch (error) {
    if (getPlatform() !== 'darwin') {
      throw error
    }

    logInfo('apps', 'shell.trashItem failed on macOS, trying Finder fallback', {
      path: targetPath,
      error
    })

    await moveMacAppToTrashWithFinder(targetPath)
  }
}

export async function listRelatedDataForApp(target: InstalledApp): Promise<AppRelatedDataItem[]> {
  const candidates = target.platform === 'mac'
    ? getMacRelatedDataCandidates(target, homedir())
    : getWindowsRelatedDataCandidates(target)

  const existingItems = await Promise.all(candidates.map(async (candidate) => {
    try {
      await fsp.access(candidate.path)
      return candidate
    } catch {
      return null
    }
  }))

  return existingItems.filter((item): item is AppRelatedDataItem => item !== null)
}

export async function trashRelatedDataForApp(
  target: InstalledApp,
  selectedIds: string[]
): Promise<{ deletedPaths: string[]; failedPaths: string[] }> {
  if (selectedIds.length === 0) {
    return { deletedPaths: [], failedPaths: [] }
  }

  const available = await listRelatedDataForApp(target)
  const availableById = new Map(available.map((item) => [item.id, item]))
  const uniqueSelectedItems = [...new Set(selectedIds)]
    .map((itemId) => availableById.get(itemId))
    .filter((item): item is AppRelatedDataItem => item !== undefined)

  const deletedPaths: string[] = []
  const failedPaths: string[] = []

  for (const item of uniqueSelectedItems) {
    try {
      await trashPathWithFallback(item.path)
      deletedPaths.push(item.path)
    } catch (error) {
      failedPaths.push(item.path)
      logWarn('apps', 'Failed to trash related app data', {
        appId: target.id,
        name: target.name,
        relatedPath: item.path,
        relatedItemId: item.id,
        error
      })
    }
  }

  return { deletedPaths, failedPaths }
}

export function buildRemovalMessage(baseMessage: string, deletedCount: number, failedCount: number): string {
  if (deletedCount === 0 && failedCount === 0) {
    return baseMessage
  }

  if (failedCount === 0) {
    return tk('main.apps.message.with_related_all', { baseMessage, deletedCount })
  }

  return tk('main.apps.message.with_related_partial', {
    baseMessage,
    deletedCount,
    failedCount
  })
}
