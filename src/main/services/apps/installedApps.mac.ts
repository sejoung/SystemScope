import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { homedir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { AppLeftoverDataItem, AppRelatedDataItem, InstalledApp } from '@shared/types'
import { logDebug } from '@main/services/core/logging'
import { tk } from '../../i18n'
import { getDirSize } from '../../utils/getDirSize'
import {
  createRelatedDataItem,
  dedupeByPath,
  dedupeLeftoverByPath,
  applyCachedLeftoverSizes,
  runWithConcurrency
} from './installedAppsShared'

const execFileAsync = promisify(execFile)
const leftoverSizeCache = new Map<string, number>()
const LEFTOVER_SIZE_HYDRATE_CONCURRENCY = 2

// Vendors nest apps in plain folders under /Applications (e.g. "CLIP STUDIO 1.5",
// "nProtect/..."). The folder is the real uninstall unit — trashing just the inner
// .app would leave the rest of the vendor folder behind — so such folders are listed
// as one app each. Folders that merely group independent apps are the exception and
// get their contents listed individually instead.
const NESTED_APP_SCAN_DEPTH = 4
const EPIC_GAMES_ROOT = '/Users/Shared/Epic Games'
const APP_COLLECTION_FOLDERS = new Set(['Utilities', 'Setapp'])

function isAppCollectionFolder(name: string): boolean {
  return APP_COLLECTION_FOLDERS.has(name) || name.endsWith('.localized')
}

export async function listMacInstalledApps(): Promise<InstalledApp[]> {
  const roots = ['/Applications', path.join(homedir(), 'Applications')]
  const currentAppBundlePath = getCurrentMacAppBundlePath()
  const apps: InstalledApp[] = []

  for (const root of roots) {
    let entries
    try {
      entries = await fsp.readdir(root, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const entryPath = path.join(root, entry.name)

      if (entry.name.endsWith('.app')) {
        apps.push(await buildMacAppEntry(entryPath, currentAppBundlePath))
      } else if (isAppCollectionFolder(entry.name)) {
        // A folder of independent apps — list each one on its own.
        const bundlePaths: string[] = []
        await collectMacAppBundles(entryPath, NESTED_APP_SCAN_DEPTH - 1, bundlePaths)
        for (const appPath of bundlePaths) {
          apps.push(await buildMacAppEntry(appPath, currentAppBundlePath))
        }
      } else {
        // A vendor folder — one entry for the whole folder if it contains any app.
        const folderEntry = await buildMacFolderAppEntry(entryPath, entry.name, currentAppBundlePath)
        if (folderEntry) apps.push(folderEntry)
      }
    }
  }

  await collectEpicGamesInstalls(apps)

  return apps
}

async function buildMacAppEntry(appPath: string, currentAppBundlePath: string | null): Promise<InstalledApp> {
  const metadata = await readMacAppMetadata(appPath)
  const protectedApp = appPath.startsWith('/System/Applications') || appPath === currentAppBundlePath

  return {
    id: appPath,
    name: metadata.name,
    version: metadata.version,
    publisher: metadata.bundleId,
    bundleId: metadata.bundleId,
    installLocation: path.dirname(appPath),
    launchPath: appPath,
    platform: 'mac',
    uninstallKind: 'trash_app',
    protected: protectedApp,
    protectedReason: protectedApp ? tk('main.apps.protected.system_app') : undefined
  }
}

/** One entry representing a vendor folder (trashed as a whole), or null when it contains no app. */
async function buildMacFolderAppEntry(
  folderPath: string,
  folderName: string,
  currentAppBundlePath: string | null
): Promise<InstalledApp | null> {
  const bundlePaths: string[] = []
  await collectMacAppBundles(folderPath, NESTED_APP_SCAN_DEPTH - 1, bundlePaths)
  if (bundlePaths.length === 0) return null

  // Borrow version/bundle id from the first inner app; the name stays the folder's.
  const metadata = await readMacAppMetadata(bundlePaths[0])
  const containsCurrentApp = currentAppBundlePath !== null && currentAppBundlePath.startsWith(folderPath + path.sep)

  return {
    id: folderPath,
    name: folderName,
    version: metadata.version,
    publisher: metadata.bundleId,
    bundleId: metadata.bundleId,
    installLocation: path.dirname(folderPath),
    launchPath: folderPath,
    platform: 'mac',
    uninstallKind: 'trash_app',
    protected: containsCurrentApp,
    protectedReason: containsCurrentApp ? tk('main.apps.protected.system_app') : undefined
  }
}

/** Collect .app bundles in `dir`, descending into plain folders up to `depth` levels (never into .app bundles). */
async function collectMacAppBundles(dir: string, depth: number, found: string[]): Promise<void> {
  let entries
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.name.endsWith('.app')) {
      found.push(fullPath)
    } else if (depth > 1) {
      await collectMacAppBundles(fullPath, depth - 1, found)
    }
  }
}

/**
 * Epic Games installs (Unreal Engine, games) live in /Users/Shared/Epic Games as plain
 * folders with the .app buried deep inside; the folder itself is the uninstall unit,
 * so each top-level folder is listed as one app and trashed as a whole.
 */
async function collectEpicGamesInstalls(apps: InstalledApp[]): Promise<void> {
  let entries
  try {
    entries = await fsp.readdir(EPIC_GAMES_ROOT, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const folderPath = path.join(EPIC_GAMES_ROOT, entry.name)
    const ueMatch = /^UE_(.+)$/.exec(entry.name)

    apps.push({
      id: folderPath,
      name: ueMatch ? `Unreal Engine ${ueMatch[1]}` : entry.name,
      version: ueMatch?.[1],
      publisher: 'Epic Games',
      installLocation: EPIC_GAMES_ROOT,
      launchPath: folderPath,
      platform: 'mac',
      uninstallKind: 'trash_app',
      protected: false
    })
  }
}

async function readMacAppMetadata(appPath: string): Promise<{ name: string; version?: string; bundleId?: string }> {
  const fallbackName = path.basename(appPath, '.app')
  const plistPath = path.join(appPath, 'Contents', 'Info.plist')

  const version = await readMacPlistValue(plistPath, 'CFBundleShortVersionString')
  const bundleId = await readMacPlistValue(plistPath, 'CFBundleIdentifier')

  if (!version && !bundleId) {
    logDebug('apps', 'macOS app metadata unavailable, using bundle name fallback', { appPath })
  }

  return {
    name: fallbackName,
    version,
    bundleId
  }
}

function getCurrentMacAppBundlePath(): string | null {
  const exePath = app.getPath('exe')
  const parts = exePath.split(path.sep)
  const appIndex = parts.findIndex((part) => part.endsWith('.app'))
  if (appIndex === -1) return null
  return parts.slice(0, appIndex + 1).join(path.sep)
}

async function readMacPlistValue(plistPath: string, key: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('defaults', ['read', plistPath, key])
    const value = stdout.trim()
    return value || undefined
  } catch {
    return undefined
  }
}

export async function moveMacAppToTrashWithFinder(appPath: string): Promise<void> {
  const script = [
    'on run argv',
    'set targetPath to POSIX file (item 1 of argv)',
    'tell application "Finder"',
    'delete targetPath',
    'end tell',
    'end run'
  ].join('\n')

  await execFileAsync('osascript', ['-e', script, appPath])
}

export function getMacRelatedDataCandidates(
  target: Pick<InstalledApp, 'name' | 'bundleId'>,
  homeDir: string
): AppRelatedDataItem[] {
  const libraryRoot = path.join(homeDir, 'Library')
  const candidateNames = [...new Set([target.bundleId, target.name].filter(Boolean) as string[])]
  const candidates: AppRelatedDataItem[] = []

  for (const name of candidateNames) {
    candidates.push(
      createRelatedDataItem(path.join(libraryRoot, 'Application Support', name), 'Application Support', 'mac:application-support'),
      createRelatedDataItem(path.join(libraryRoot, 'Caches', name), 'Caches', 'mac:caches'),
      createRelatedDataItem(path.join(libraryRoot, 'Logs', name), 'Logs', 'mac:logs')
    )
  }

  if (target.bundleId) {
    candidates.push(
      createRelatedDataItem(path.join(libraryRoot, 'Preferences', `${target.bundleId}.plist`), 'Preferences', 'mac:preferences'),
      createRelatedDataItem(path.join(libraryRoot, 'Saved Application State', `${target.bundleId}.savedState`), 'Saved State', 'mac:saved-state'),
      createRelatedDataItem(path.join(libraryRoot, 'Containers', target.bundleId), 'Container', 'mac:container')
    )
  }

  return dedupeByPath(candidates)
}

export async function listMacLeftoverAppData(installedApps: InstalledApp[]): Promise<AppLeftoverDataItem[]> {
  leftoverSizeCache.clear()
  const knownNames = new Set(installedApps.map((a) => a.name.toLowerCase()))
  const knownBundleIds = new Set(installedApps.map((a) => a.bundleId?.toLowerCase()).filter(Boolean))
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
