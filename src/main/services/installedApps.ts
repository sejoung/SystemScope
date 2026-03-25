import { shell } from 'electron'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { homedir, platform as getPlatform } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type {
  AppLeftoverDataItem,
  AppLeftoverRegistryItem,
  AppRelatedDataItem,
  AppRemovalResult,
  AppUninstallRequest,
  InstalledApp
} from '@shared/types'
import { logInfo, logWarn } from './logging'
import { tk } from '../i18n'
import {
  listMacInstalledApps,
  moveMacAppToTrashWithFinder,
  getMacRelatedDataCandidates,
  listMacLeftoverAppData,
  inferMacLeftoverAppName,
  hydrateMacLeftoverItemSizes
} from './installedApps.mac'
import {
  listWindowsInstalledApps,
  listWindowsLeftoverRegistryEntries,
  launchWindowsUninstaller,
  getWindowsRelatedDataCandidates,
  listWindowsLeftoverAppData,
  parseWindowsRegistryOutput,
  parseUninstallCommand,
  splitWindowsCommandArgs,
  buildWindowsUninstallerPowerShellCommand,
  hydrateWindowsLeftoverItemSizes
} from './installedApps.windows'

const execFileAsync = promisify(execFile)
const installedAppsCache = new Map<string, InstalledApp>()
const leftoverAppDataCache = new Map<string, AppLeftoverDataItem>()
const leftoverRegistryCache = new Map<string, AppLeftoverRegistryItem>()

// ─── Re-exports for tests ───

export {
  parseWindowsRegistryOutput,
  parseUninstallCommand,
  splitWindowsCommandArgs,
  buildWindowsUninstallerPowerShellCommand,
  getWindowsRelatedDataCandidates,
  getMacRelatedDataCandidates,
  inferMacLeftoverAppName
}

// ─── Public API ───

export async function listInstalledApps(): Promise<InstalledApp[]> {
  const apps = getPlatform() === 'darwin'
    ? await listMacInstalledApps()
    : getPlatform() === 'win32'
      ? await listWindowsInstalledApps()
      : []

  installedAppsCache.clear()
  for (const entry of apps) {
    installedAppsCache.set(entry.id, entry)
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name))
}

async function getInstalledAppsSnapshot(): Promise<InstalledApp[]> {
  if (installedAppsCache.size > 0) {
    return [...installedAppsCache.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  return listInstalledApps()
}

export function getInstalledAppById(appId: string): InstalledApp | null {
  return installedAppsCache.get(appId) ?? null
}

export async function getInstalledAppRelatedData(appId: string): Promise<AppRelatedDataItem[]> {
  const target = installedAppsCache.get(appId)
  if (!target) {
    throw new Error(tk('main.apps.error.not_found'))
  }

  return listRelatedDataForApp(target)
}

export async function listLeftoverAppData(): Promise<AppLeftoverDataItem[]> {
  const installedApps = await getInstalledAppsSnapshot()
  const leftovers = getPlatform() === 'darwin'
    ? await listMacLeftoverAppData(installedApps)
    : getPlatform() === 'win32'
      ? await listWindowsLeftoverAppData(installedApps)
      : []

  leftoverAppDataCache.clear()
  for (const item of leftovers) {
    leftoverAppDataCache.set(item.id, item)
  }

  return leftovers.sort((a, b) => a.appName.localeCompare(b.appName) || a.path.localeCompare(b.path))
}

export async function removeLeftoverAppData(itemIds: string[]): Promise<{ deletedPaths: string[]; failedPaths: string[] }> {
  const uniqueItems = [...new Set(itemIds)]
    .map((itemId) => leftoverAppDataCache.get(itemId))
    .filter((item): item is AppLeftoverDataItem => item !== undefined)
  const deletedPaths: string[] = []
  const failedPaths: string[] = []

  for (const item of uniqueItems) {
    try {
      await trashPathWithFallback(item.path)
      leftoverAppDataCache.delete(item.id)
      deletedPaths.push(item.path)
    } catch (error) {
      failedPaths.push(item.path)
      logWarn('apps', 'Failed to trash leftover app data', { targetPath: item.path, itemId: item.id, error })
    }
  }

  return { deletedPaths, failedPaths }
}

export async function hydrateLeftoverAppDataSizes(itemIds: string[]): Promise<AppLeftoverDataItem[]> {
  const uniqueItems = [...new Set(itemIds)]
    .map((itemId) => leftoverAppDataCache.get(itemId))
    .filter((item): item is AppLeftoverDataItem => item !== undefined)

  const hydrated = getPlatform() === 'darwin'
    ? await hydrateMacLeftoverItemSizes(uniqueItems)
    : getPlatform() === 'win32'
      ? await hydrateWindowsLeftoverItemSizes(uniqueItems)
      : uniqueItems

  for (const item of hydrated) {
    leftoverAppDataCache.set(item.id, item)
  }

  return hydrated
}

export async function listLeftoverAppRegistry(): Promise<AppLeftoverRegistryItem[]> {
  if (getPlatform() !== 'win32') {
    return []
  }

  const items = await listWindowsLeftoverRegistryEntries()
  logInfo('apps', 'Loaded leftover uninstall registry entries', {
    count: items.length
  })
  leftoverRegistryCache.clear()
  for (const item of items) {
    leftoverRegistryCache.set(item.id, item)
  }

  return items.sort((a, b) => a.appName.localeCompare(b.appName) || a.registryPath.localeCompare(b.registryPath))
}

export async function removeLeftoverAppRegistry(itemIds: string[]): Promise<{ deletedKeys: string[]; failedKeys: string[] }> {
  if (getPlatform() !== 'win32') {
    return { deletedKeys: [], failedKeys: [] }
  }

  const uniqueItems = [...new Set(itemIds)]
    .map((itemId) => leftoverRegistryCache.get(itemId))
    .filter((item): item is AppLeftoverRegistryItem => item !== undefined)

  const deletedKeys: string[] = []
  const failedKeys: string[] = []

  for (const item of uniqueItems) {
    try {
      await execFileAsync('reg', ['delete', item.registryPath, '/f'], {
        windowsHide: true
      })
      leftoverRegistryCache.delete(item.id)
      deletedKeys.push(item.registryPath)
    } catch (error) {
      failedKeys.push(item.registryPath)
      logWarn('apps', 'Failed to remove leftover uninstall registry entry', {
        registryPath: item.registryPath,
        itemId: item.id,
        error
      })
    }
  }

  return { deletedKeys, failedKeys }
}

export async function openInstalledAppLocation(appId: string): Promise<void> {
  const target = installedAppsCache.get(appId)
  if (!target) {
    throw new Error(tk('main.apps.error.not_found'))
  }

  const targetPath = target.platform === 'mac'
    ? target.launchPath
    : target.installLocation || target.launchPath

  if (!targetPath) {
    throw new Error(tk('main.apps.error.no_install_path'))
  }

  const stat = await fsp.stat(targetPath).catch(() => null)
  if (!stat) {
    throw new Error(tk('main.apps.error.no_install_path'))
  }

  if (stat.isDirectory() && path.extname(targetPath).toLowerCase() !== '.app') {
    const openResult = await shell.openPath(targetPath)
    if (openResult) {
      throw new Error(openResult)
    }
    return
  }

  shell.showItemInFolder(targetPath)
}

export async function openSystemUninstallSettings(): Promise<void> {
  if (getPlatform() !== 'win32') {
    throw new Error(tk('main.apps.error.unsupported_os'))
  }

  await shell.openExternal('ms-settings:appsfeatures')
}

export async function uninstallInstalledApp(request: AppUninstallRequest): Promise<AppRemovalResult> {
  const target = installedAppsCache.get(request.appId)
  if (!target) {
    throw new Error(tk('main.apps.error.not_found'))
  }

  if (target.protected) {
    throw new Error(target.protectedReason ?? tk('main.apps.error.protected'))
  }

  if (target.platform === 'mac') {
    if (!target.launchPath) {
      throw new Error(tk('main.apps.error.no_app_path'))
    }

    await trashPathWithFallback(target.launchPath)
    const relatedCleanup = await trashRelatedDataForApp(target, request.relatedDataIds ?? [])
    installedAppsCache.delete(request.appId)
    logInfo('apps', 'Moved macOS app bundle to trash', {
      appId: request.appId,
      name: target.name,
      path: target.launchPath,
      relatedDataDeletedCount: relatedCleanup.deletedPaths.length,
      relatedDataFailedCount: relatedCleanup.failedPaths.length
    })
    return {
      id: target.id,
      name: target.name,
      started: true,
      completed: true,
      cancelled: false,
      action: 'trash',
      message: buildRemovalMessage(tk('main.apps.message.moved_to_trash'), relatedCleanup.deletedPaths.length, relatedCleanup.failedPaths.length),
      relatedDataDeletedCount: relatedCleanup.deletedPaths.length,
      relatedDataFailedPaths: relatedCleanup.failedPaths
    }
  }

  if (target.uninstallKind === 'open_settings') {
    await openSystemUninstallSettings()
    return {
      id: target.id,
      name: target.name,
      started: true,
      completed: false,
      cancelled: false,
      action: 'open_settings',
      message: tk('main.apps.message.opened_system_settings')
    }
  }

  if (!target.uninstallCommand) {
    throw new Error(tk('main.apps.error.no_uninstall_command'))
  }

  logInfo('apps', 'Launching Windows uninstaller', {
    appId: request.appId,
    name: target.name,
    uninstallCommand: target.uninstallCommand
  })
  await launchWindowsUninstaller(target.uninstallCommand)
  const relatedCleanup = await trashRelatedDataForApp(target, request.relatedDataIds ?? [])
  logInfo('apps', 'Started Windows uninstall command', {
    appId: request.appId,
    name: target.name,
    relatedDataDeletedCount: relatedCleanup.deletedPaths.length,
    relatedDataFailedCount: relatedCleanup.failedPaths.length
  })
  return {
    id: target.id,
    name: target.name,
    started: true,
    completed: false,
    cancelled: false,
    action: 'uninstaller',
    message: buildRemovalMessage(tk('main.apps.message.started_uninstaller'), relatedCleanup.deletedPaths.length, relatedCleanup.failedPaths.length),
    relatedDataDeletedCount: relatedCleanup.deletedPaths.length,
    relatedDataFailedPaths: relatedCleanup.failedPaths
  }
}

// ─── Internal helpers ───

async function trashPathWithFallback(targetPath: string): Promise<void> {
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

async function listRelatedDataForApp(target: InstalledApp): Promise<AppRelatedDataItem[]> {
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

async function trashRelatedDataForApp(
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

function buildRemovalMessage(baseMessage: string, deletedCount: number, failedCount: number): string {
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
