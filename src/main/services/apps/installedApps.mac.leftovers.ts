import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { homedir } from 'node:os'
import type { AppLeftoverDataItem, AppRelatedDataItem, InstalledApp } from '@shared/types'
import { tk } from '../../i18n'
import { getDirSize } from '../../utils/getDirSize'
import { runWithConcurrency } from '@main/services/core/runWithConcurrency'
import { createRelatedDataItem, dedupeByPath, dedupeLeftoverByPath, applyCachedLeftoverSizes } from './installedAppsShared'

const leftoverSizeCache = new Map<string, number>()
const LEFTOVER_SIZE_HYDRATE_CONCURRENCY = 2

export function getMacRelatedDataCandidates(
  target: Pick<InstalledApp, 'name' | 'bundleId' | 'containedApps'>,
  homeDir: string
): AppRelatedDataItem[] {
  const libraryRoot = path.join(homeDir, 'Library')
  // Folder-based entries carry their inner apps — removing the folder removes those
  // apps, so their data dirs are related data of this entry too.
  const contained = target.containedApps ?? []
  const candidateNames = [
    ...new Set(
      [target.bundleId, target.name, ...contained.map((a) => a.name), ...contained.map((a) => a.bundleId)].filter(Boolean) as string[]
    )
  ]
  const candidateBundleIds = [...new Set([target.bundleId, ...contained.map((a) => a.bundleId)].filter(Boolean) as string[])]
  const candidates: AppRelatedDataItem[] = []

  for (const name of candidateNames) {
    candidates.push(
      createRelatedDataItem(path.join(libraryRoot, 'Application Support', name), 'Application Support', 'mac:application-support'),
      createRelatedDataItem(path.join(libraryRoot, 'Caches', name), 'Caches', 'mac:caches'),
      createRelatedDataItem(path.join(libraryRoot, 'Logs', name), 'Logs', 'mac:logs')
    )
  }

  for (const bundleId of candidateBundleIds) {
    candidates.push(
      createRelatedDataItem(path.join(libraryRoot, 'Preferences', `${bundleId}.plist`), 'Preferences', 'mac:preferences'),
      createRelatedDataItem(path.join(libraryRoot, 'Saved Application State', `${bundleId}.savedState`), 'Saved State', 'mac:saved-state'),
      createRelatedDataItem(path.join(libraryRoot, 'Containers', bundleId), 'Container', 'mac:container')
    )
  }

  return dedupeByPath(candidates)
}

export async function listMacLeftoverAppData(installedApps: InstalledApp[]): Promise<AppLeftoverDataItem[]> {
  leftoverSizeCache.clear()
  // Folder-based entries (vendor folders, Epic Games) list their inner apps in
  // containedApps — those apps are installed too, so their data is not leftover.
  const knownNames = new Set(
    installedApps.flatMap((a) => [a.name.toLowerCase(), ...(a.containedApps?.map((c) => c.name.toLowerCase()) ?? [])])
  )
  const knownBundleIds = new Set(
    installedApps.flatMap((a) => [a.bundleId?.toLowerCase(), ...(a.containedApps?.map((c) => c.bundleId?.toLowerCase()) ?? [])]).filter(Boolean)
  )
  const homeDir = homedir()
  const specs = [
    { root: path.join(homeDir, 'Library', 'Application Support'), type: 'dir', label: 'Application Support', source: 'mac:application-support' },
    { root: path.join(homeDir, 'Library', 'Caches'), type: 'dir', label: 'Caches', source: 'mac:caches' },
    { root: path.join(homeDir, 'Library', 'Logs'), type: 'dir', label: 'Logs', source: 'mac:logs' },
    { root: path.join(homeDir, 'Library', 'Saved Application State'), type: 'dir', label: 'Saved State', source: 'mac:saved-state' },
    { root: path.join(homeDir, 'Library', 'Preferences'), type: 'plist', label: 'Preferences', source: 'mac:preferences' }
  ] as const

  const items: AppLeftoverDataItem[] = []

  for (const spec of specs) {
    let entries
    try {
      entries = await fsp.readdir(spec.root, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (spec.type === 'dir' && !entry.isDirectory()) continue
      if (spec.type === 'plist' && (!entry.isFile() || !entry.name.endsWith('.plist'))) continue

      const appName = inferMacLeftoverAppName(entry.name)
      if (!appName) continue

      const normalized = appName.toLowerCase()
      if (knownNames.has(normalized) || knownBundleIds.has(normalized)) continue
      const targetPath = path.join(spec.root, entry.name)

      items.push({
        id: `${spec.source}:${targetPath}`,
        appName,
        label: spec.label,
        path: targetPath,
        source: spec.source,
        platform: 'mac',
        ...getMacLeftoverGuidance(spec.label, appName)
      })
    }
  }

  const dedupedItems = dedupeLeftoverByPath(items)
  applyCachedLeftoverSizes(dedupedItems, leftoverSizeCache)
  return dedupedItems
}

export async function hydrateMacLeftoverItemSizes(items: AppLeftoverDataItem[]): Promise<AppLeftoverDataItem[]> {
  applyCachedLeftoverSizes(items, leftoverSizeCache)

  const pendingItems = items.filter((item) => item.sizeBytes === undefined)
  await runWithConcurrency(pendingItems, LEFTOVER_SIZE_HYDRATE_CONCURRENCY, async (item) => {
    const sizeBytes = await getItemSize(item.path, item.label === 'Preferences' ? 'plist' : 'dir')
    leftoverSizeCache.set(item.path, sizeBytes)
    item.sizeBytes = sizeBytes
  })

  return items
}

export function inferMacLeftoverAppName(entryName: string): string | null {
  const withoutPlist = entryName.endsWith('.plist') ? entryName.slice(0, -6) : entryName
  const withoutSavedState = withoutPlist.endsWith('.savedState') ? withoutPlist.slice(0, -11) : withoutPlist
  const trimmed = withoutSavedState.trim()
  return trimmed || null
}

function getMacLeftoverGuidance(
  label: AppLeftoverDataItem['label'],
  appName: string
): Pick<AppLeftoverDataItem, 'confidence' | 'reason' | 'risk'> {
  if (label === 'Container' || label === 'Saved State') {
    return {
      confidence: 'high',
      reason: tk('main.apps.leftover.mac.container_reason', { label: label.toLowerCase() }),
      risk: tk('main.apps.leftover.mac.container_risk')
    }
  }

  if (label === 'Preferences') {
    return {
      confidence: appName.includes('.') ? 'high' : 'medium',
      reason: appName.includes('.')
        ? tk('main.apps.leftover.mac.pref_bundle_reason')
        : tk('main.apps.leftover.mac.pref_name_reason'),
      risk: tk('main.apps.leftover.mac.pref_risk')
    }
  }

  if (label === 'Application Support') {
    return {
      confidence: 'medium',
      reason: tk('main.apps.leftover.mac.support_reason'),
      risk: tk('main.apps.leftover.mac.support_risk')
    }
  }

  return {
    confidence: 'medium',
    reason: tk('main.apps.leftover.mac.default_reason', { label: label.toLowerCase() }),
    risk: tk('main.apps.leftover.mac.default_risk')
  }
}

// ─── Local helpers ───

async function getItemSize(targetPath: string, type: 'dir' | 'plist'): Promise<number> {
  if (type === 'dir') {
    return getDirSize(targetPath)
  }

  try {
    const stat = await fsp.stat(targetPath)
    return stat.size
  } catch {
    return 0
  }
}
