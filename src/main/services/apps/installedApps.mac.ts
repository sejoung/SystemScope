import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { homedir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { InstalledApp } from '@shared/types'
import { logDebug } from '@main/services/core/logging'
import { createConcurrencyLimiter, runWithConcurrency } from '@main/services/core/runWithConcurrency'
import { tk } from '../../i18n'

const execFileAsync = promisify(execFile)

// Vendors nest apps in plain folders under /Applications (e.g. "CLIP STUDIO 1.5",
// "nProtect/..."). The folder is the real uninstall unit — trashing just the inner
// .app would leave the rest of the vendor folder behind — so such folders are listed
// as one app each. Folders that merely group independent apps (known collection
// folders, or folders whose inner apps come from different vendors, like a
// user-created "Games" folder) get their contents listed individually instead.

/** How many nested folder levels to descend below a vendor folder when looking for .app bundles (nProtect needs 2: nProtect/V1/NOS/nosudt.app). */
const MAX_FOLDER_DESCENT = 2
const EPIC_GAMES_ROOT = '/Users/Shared/Epic Games'
const APP_COLLECTION_FOLDERS = new Set(['Utilities', 'Setapp'])
const FOLDER_METADATA_APP_LIMIT = 20
const APP_DISCOVERY_CONCURRENCY = 6
const metadataLimit = createConcurrencyLimiter(8)

function isAppCollectionFolder(name: string): boolean {
  return APP_COLLECTION_FOLDERS.has(name) || name.endsWith('.localized')
}

/** "com.celsys.clipstudiopaint" → "com.celsys"; undefined when the id is missing or not reverse-DNS. */
function bundleIdVendor(bundleId: string | undefined): string | undefined {
  if (!bundleId) return undefined
  const segments = bundleId.split('.')
  if (segments.length < 3) return undefined
  return `${segments[0]}.${segments[1]}`.toLowerCase()
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

    const candidates = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    const discovered: InstalledApp[][] = Array.from({ length: candidates.length }, () => [])
    await runWithConcurrency(candidates.map((entry, index) => ({ entry, index })), APP_DISCOVERY_CONCURRENCY, async ({ entry, index }) => {
      const entryPath = path.join(root, entry.name)

      if (entry.name.endsWith('.app')) {
        discovered[index] = [await buildMacAppEntry(entryPath, currentAppBundlePath)]
      } else {
        discovered[index] = await expandPlainFolder(entryPath, entry.name, currentAppBundlePath)
      }
    })
    apps.push(...discovered.flat())
  }

  await collectEpicGamesInstalls(apps)

  return apps
}

/**
 * Turn a non-.app folder into app entries: a vendor folder becomes one folder-unit
 * entry, a collection of independent apps becomes one entry per inner app, and a
 * folder without any .app inside becomes nothing.
 */
async function expandPlainFolder(folderPath: string, folderName: string, currentAppBundlePath: string | null): Promise<InstalledApp[]> {
  const bundlePaths: string[] = []
  await collectMacAppBundles(folderPath, MAX_FOLDER_DESCENT, bundlePaths)
  if (bundlePaths.length === 0) return []

  const innerApps = await readInnerAppsMetadata(bundlePaths)
  const vendors = new Set(innerApps.map((a) => bundleIdVendor(a.bundleId)).filter(Boolean))

  // Apps from more than one vendor means this folder merely groups independent
  // apps (e.g. a user-made "Games" folder) — trashing it as one unit would
  // delete unrelated apps, so list the contents individually instead.
  if (isAppCollectionFolder(folderName) || vendors.size > 1) {
    return Promise.all(bundlePaths.map((appPath) => buildMacAppEntry(appPath, currentAppBundlePath)))
  }

  return [buildMacFolderAppEntry(folderPath, folderName, innerApps, currentAppBundlePath)]
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

async function readInnerAppsMetadata(bundlePaths: string[]): Promise<Array<{ name: string; bundleId?: string }>> {
  const limitedPaths = bundlePaths.slice(0, FOLDER_METADATA_APP_LIMIT)
  const results: Array<{ name: string; bundleId?: string }> = Array(limitedPaths.length)
  await runWithConcurrency(limitedPaths.map((appPath, index) => ({ appPath, index })), APP_DISCOVERY_CONCURRENCY, async ({ appPath, index }) => {
    const metadata = await readMacPlistMetadata(path.join(appPath, 'Contents', 'Info.plist'))
    results[index] = { name: path.basename(appPath, '.app'), bundleId: metadata.bundleId }
  })
  return results
}

/**
 * One entry representing a vendor folder, trashed as a whole. Every inner app's
 * name/bundleId is kept in containedApps so leftover-data detection and related-data
 * cleanup still recognize those apps as installed / belonging to this entry.
 */
function buildMacFolderAppEntry(
  folderPath: string,
  folderName: string,
  innerApps: Array<{ name: string; bundleId?: string }>,
  currentAppBundlePath: string | null
): InstalledApp {
  const containsCurrentApp = currentAppBundlePath !== null && currentAppBundlePath.startsWith(folderPath + path.sep)

  return {
    id: folderPath,
    name: folderName,
    version: undefined,
    publisher: innerApps[0]?.bundleId,
    bundleId: innerApps[0]?.bundleId,
    installLocation: path.dirname(folderPath),
    launchPath: folderPath,
    platform: 'mac',
    uninstallKind: 'trash_app',
    protected: containsCurrentApp,
    protectedReason: containsCurrentApp ? tk('main.apps.protected.system_app') : undefined,
    containedApps: innerApps
  }
}

/**
 * Collect .app bundles inside `dir`. `remainingDescents` is how many nested folder
 * levels may still be entered below `dir` (0 = scan `dir` itself only); .app bundles
 * are never descended into.
 */
async function collectMacAppBundles(dir: string, remainingDescents: number, found: string[]): Promise<void> {
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
    } else if (remainingDescents > 0) {
      await collectMacAppBundles(fullPath, remainingDescents - 1, found)
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

  const { version, bundleId } = await readMacPlistMetadata(plistPath)

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

async function readMacPlistMetadata(plistPath: string): Promise<{ version?: string; bundleId?: string }> {
  try {
    const { stdout } = await metadataLimit(() => execFileAsync('plutil', ['-convert', 'json', '-o', '-', plistPath]))
    const parsed = JSON.parse(stdout) as Record<string, unknown>
    return {
      version: typeof parsed.CFBundleShortVersionString === 'string' ? parsed.CFBundleShortVersionString : undefined,
      bundleId: typeof parsed.CFBundleIdentifier === 'string' ? parsed.CFBundleIdentifier : undefined
    }
  } catch {
    return {}
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

export { getMacRelatedDataCandidates, listMacLeftoverAppData, hydrateMacLeftoverItemSizes, inferMacLeftoverAppName } from './installedApps.mac.leftovers'
