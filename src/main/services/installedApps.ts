import { app, shell } from 'electron'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { homedir, platform as getPlatform } from 'os'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import type { AppLeftoverDataItem, AppRelatedDataItem, AppRemovalResult, AppUninstallRequest, InstalledApp } from '@shared/types'
import { logDebug, logError, logInfo, logWarn } from './logging'
import { tk } from '../i18n'

const execFileAsync = promisify(execFile)
const installedAppsCache = new Map<string, InstalledApp>()
const leftoverAppDataCache = new Map<string, AppLeftoverDataItem>()

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
  const installedApps = await listInstalledApps()
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
      await trashPathWithFallback(item.path, 'leftover')
      leftoverAppDataCache.delete(item.id)
      deletedPaths.push(item.path)
    } catch (error) {
      failedPaths.push(item.path)
      logWarn('apps', 'Failed to trash leftover app data', { targetPath: item.path, itemId: item.id, error })
    }
  }

  return { deletedPaths, failedPaths }
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

    await trashPathWithFallback(target.launchPath, 'mac-app', {
      appId: request.appId,
      name: target.name
    })
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
      message: buildRemovalMessage(tk('main.apps.message.moved_to_trash'), relatedCleanup.deletedPaths.length, relatedCleanup.failedPaths.length),
      relatedDataDeletedCount: relatedCleanup.deletedPaths.length,
      relatedDataFailedPaths: relatedCleanup.failedPaths
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
    message: buildRemovalMessage(tk('main.apps.message.started_uninstaller'), relatedCleanup.deletedPaths.length, relatedCleanup.failedPaths.length),
    relatedDataDeletedCount: relatedCleanup.deletedPaths.length,
    relatedDataFailedPaths: relatedCleanup.failedPaths
  }
}

export function parseWindowsRegistryOutput(raw: string): InstalledApp[] {
  const blocks = raw.split(/\r?\n\r?\n+/).map((block) => block.trim()).filter(Boolean)
  const apps: InstalledApp[] = []
  const seen = new Set<string>()
  const currentExe = app.getPath('exe')

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter(Boolean)
    const registryPath = lines[0]?.trim()
    if (!registryPath?.startsWith('HKEY_')) {
      continue
    }

    const values = new Map<string, string>()
    for (const line of lines.slice(1)) {
      const match = line.match(/^\s+([^\s]+)\s+REG_\w+\s+(.*)$/)
      if (!match) continue
      values.set(match[1], match[2].trim())
    }

    const name = values.get('DisplayName')
    if (!name) continue

    const installLocation = sanitizeRegistryValue(values.get('InstallLocation'))
    const uninstallCommand = sanitizeRegistryValue(values.get('UninstallString'))
    const quietUninstallCommand = sanitizeRegistryValue(values.get('QuietUninstallString'))
    const launchPath = installLocation ? currentExeIfInside(currentExe, installLocation) : undefined
    const isProtected = Boolean(launchPath)

    const appRecord: InstalledApp = {
      id: registryPath,
      name,
      version: sanitizeRegistryValue(values.get('DisplayVersion')) ?? undefined,
      publisher: sanitizeRegistryValue(values.get('Publisher')) ?? undefined,
      installLocation: installLocation ?? undefined,
      launchPath,
      uninstallCommand: uninstallCommand ?? undefined,
      quietUninstallCommand: quietUninstallCommand ?? undefined,
      platform: 'windows',
      uninstallKind: uninstallCommand ? 'uninstall_command' : 'open_settings',
      protected: isProtected,
      protectedReason: isProtected ? tk('main.apps.protected.current_app') : undefined
    }

    const dedupeKey = `${appRecord.name}::${appRecord.version ?? ''}::${appRecord.publisher ?? ''}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    apps.push(appRecord)
  }

  return apps
}

async function listMacInstalledApps(): Promise<InstalledApp[]> {
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
      if (!entry.isDirectory() || !entry.name.endsWith('.app')) continue
      const appPath = path.join(root, entry.name)
      const metadata = await readMacAppMetadata(appPath)
      const protectedApp = appPath.startsWith('/System/Applications') || appPath === currentAppBundlePath

      apps.push({
        id: appPath,
        name: metadata.name,
        version: metadata.version,
        publisher: metadata.bundleId,
        bundleId: metadata.bundleId,
        installLocation: root,
        launchPath: appPath,
        platform: 'mac',
        uninstallKind: 'trash_app',
        protected: protectedApp,
        protectedReason: protectedApp ? tk('main.apps.protected.system_app') : undefined
      })
    }
  }

  return apps
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

async function listWindowsInstalledApps(): Promise<InstalledApp[]> {
  const registryRoots = [
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ]

  const allApps: InstalledApp[] = []
  for (const registryPath of registryRoots) {
    try {
      // PowerShell의 [Console]::OutputEncoding으로 UTF-8 출력 보장
      const psCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; reg query "${registryPath}" /s`
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      })
      allApps.push(...parseWindowsRegistryOutput(stdout))
    } catch (error) {
      logWarn('apps', 'Failed to query Windows uninstall registry', { registryPath, error })
    }
  }

  return allApps
}

function sanitizeRegistryValue(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

function currentExeIfInside(currentExe: string, installLocation: string): string | undefined {
  const normalizedInstall = installLocation.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase()
  const normalizedExe = currentExe.replace(/[\\/]+/g, '\\').toLowerCase()
  return normalizedExe.startsWith(normalizedInstall) ? currentExe : undefined
}

function getCurrentMacAppBundlePath(): string | null {
  const exePath = app.getPath('exe')
  const parts = exePath.split(path.sep)
  const appIndex = parts.findIndex((part) => part.endsWith('.app'))
  if (appIndex === -1) return null
  return parts.slice(0, appIndex + 1).join(path.sep)
}

export function parseUninstallCommand(command: string): { file: string; args: string } {
  // "C:\path\uninstall.exe" /arg1 /arg2
  const quotedMatch = command.match(/^"([^"]+)"(.*)$/)
  if (quotedMatch) {
    return { file: quotedMatch[1], args: quotedMatch[2].trim() }
  }

  const executableMatch = command.match(/^(.+\.(?:exe|msi|bat|cmd|com))(?:\s+(.*))?$/i)
  if (executableMatch) {
    return {
      file: executableMatch[1],
      args: executableMatch[2]?.trim() ?? ''
    }
  }

  return { file: command, args: '' }
}

export function splitWindowsCommandArgs(args: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < args.length; i++) {
    const char = args[i]

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && /\s/.test(char)) {
      if (current) {
        result.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    result.push(current)
  }

  return result
}

export function buildWindowsUninstallerPowerShellCommand(file: string, args: string[]): string {
  const escapedFile = file.replace(/'/g, "''")
  const argListLiteral = args.length > 0
    ? `-ArgumentList @(${args.map((arg) => `'${arg.replace(/'/g, "''")}'`).join(', ')})`
    : ''
  return `Start-Process -FilePath '${escapedFile}' ${argListLiteral} -WorkingDirectory '${path.dirname(escapedFile)}' -Verb RunAs`
}

function launchWindowsUninstaller(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const { file, args } = parseUninstallCommand(command)
      const argv = splitWindowsCommandArgs(args)
      const psCommand = buildWindowsUninstallerPowerShellCommand(file, argv)

      logInfo('apps', 'Launching uninstaller process', { file, args: argv, psCommand })

      const child = spawn('powershell', ['-NoProfile', '-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
        shell: false
      })
      child.on('error', reject)
      child.on('spawn', () => {
        child.unref()
        resolve()
      })
    } catch (error) {
      logError('apps', 'Failed to start Windows uninstall command', { command, error })
      reject(error)
    }
  })
}

async function moveMacAppToTrashWithFinder(appPath: string): Promise<void> {
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

async function trashPathWithFallback(
  targetPath: string,
  reason: 'mac-app' | 'related-data' | 'leftover',
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await shell.trashItem(targetPath)
  } catch (error) {
    if (getPlatform() !== 'darwin') {
      throw error
    }

    logInfo('apps', 'shell.trashItem failed on macOS, trying Finder fallback', {
      reason,
      path: targetPath,
      ...metadata,
      error
    })

    await moveMacAppToTrashWithFinder(targetPath)
  }
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
      await trashPathWithFallback(item.path, 'related-data', {
        appId: target.id,
        name: target.name
      })
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

  return dedupeRelatedDataItems(candidates)
}

export function getWindowsRelatedDataCandidates(
  target: Pick<InstalledApp, 'name' | 'installLocation'>
): AppRelatedDataItem[] {
  const appData = process.env.APPDATA
  const localAppData = process.env.LOCALAPPDATA
  const programData = process.env.ProgramData
  const installBaseName = target.installLocation ? path.win32.basename(target.installLocation) : undefined
  const candidateNames = [...new Set([target.name, installBaseName].filter(Boolean) as string[])]
  const candidates: AppRelatedDataItem[] = []

  for (const name of candidateNames) {
    if (appData) {
      candidates.push(createRelatedDataItem(path.win32.join(appData, name), 'AppData Roaming', 'win:appdata-roaming'))
    }
    if (localAppData) {
      candidates.push(createRelatedDataItem(path.win32.join(localAppData, name), 'AppData Local', 'win:appdata-local'))
      candidates.push(createRelatedDataItem(path.win32.join(localAppData, 'Programs', name), 'Local Programs', 'win:local-programs'))
    }
    if (programData) {
      candidates.push(createRelatedDataItem(path.win32.join(programData, name), 'ProgramData', 'win:programdata'))
    }
  }

  return dedupeRelatedDataItems(candidates)
}

function createRelatedDataItem(itemPath: string, label: string, source: string): AppRelatedDataItem {
  return {
    id: `${source}:${itemPath}`,
    label,
    path: itemPath,
    source
  }
}

function dedupeRelatedDataItems(items: AppRelatedDataItem[]): AppRelatedDataItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })
}

async function listMacLeftoverAppData(installedApps: InstalledApp[]): Promise<AppLeftoverDataItem[]> {
  const knownNames = new Set(installedApps.map((app) => app.name.toLowerCase()))
  const knownBundleIds = new Set(installedApps.map((app) => app.bundleId?.toLowerCase()).filter(Boolean))
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

      items.push({
        id: `${spec.source}:${path.join(spec.root, entry.name)}`,
        appName,
        label: spec.label,
        path: path.join(spec.root, entry.name),
        source: spec.source,
        platform: 'mac',
        ...getMacLeftoverGuidance(spec.label, appName)
      })
    }
  }

  return dedupeLeftoverDataItems(items)
}

async function listWindowsLeftoverAppData(installedApps: InstalledApp[]): Promise<AppLeftoverDataItem[]> {
  const knownNames = new Set(installedApps.flatMap((app) => {
    const values = [app.name]
    if (app.installLocation) values.push(path.win32.basename(app.installLocation))
    return values.map((value) => value.toLowerCase())
  }))

  const roots = [
    { root: process.env.APPDATA, label: 'AppData Roaming', source: 'win:appdata-roaming' },
    { root: process.env.LOCALAPPDATA, label: 'AppData Local', source: 'win:appdata-local' },
    { root: process.env.LOCALAPPDATA ? path.win32.join(process.env.LOCALAPPDATA, 'Programs') : undefined, label: 'Local Programs', source: 'win:local-programs' },
    { root: process.env.ProgramData, label: 'ProgramData', source: 'win:programdata' }
  ]

  const items: AppLeftoverDataItem[] = []

  for (const spec of roots) {
    if (!spec.root) continue

    let entries
    try {
      entries = await fsp.readdir(spec.root, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const appName = entry.name.trim()
      if (!appName) continue
      if (knownNames.has(appName.toLowerCase())) continue

      items.push({
        id: `${spec.source}:${path.win32.join(spec.root, entry.name)}`,
        appName,
        label: spec.label,
        path: path.win32.join(spec.root, entry.name),
        source: spec.source,
        platform: 'windows',
        ...getWindowsLeftoverGuidance(spec.label)
      })
    }
  }

  return dedupeLeftoverDataItems(items)
}

export function inferMacLeftoverAppName(entryName: string): string | null {
  const withoutPlist = entryName.endsWith('.plist') ? entryName.slice(0, -6) : entryName
  const withoutSavedState = withoutPlist.endsWith('.savedState') ? withoutPlist.slice(0, -11) : withoutPlist
  const trimmed = withoutSavedState.trim()
  return trimmed || null
}

function dedupeLeftoverDataItems(items: AppLeftoverDataItem[]): AppLeftoverDataItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })
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

function getWindowsLeftoverGuidance(
  label: AppLeftoverDataItem['label']
): Pick<AppLeftoverDataItem, 'confidence' | 'reason' | 'risk'> {
  if (label === 'ProgramData') {
    return {
      confidence: 'medium',
      reason: tk('main.apps.leftover.win.programdata_reason'),
      risk: tk('main.apps.leftover.win.programdata_risk')
    }
  }

  if (label === 'Local Programs') {
    return {
      confidence: 'high',
      reason: tk('main.apps.leftover.win.local_programs_reason'),
      risk: tk('main.apps.leftover.win.local_programs_risk')
    }
  }

  return {
    confidence: 'medium',
    reason: tk('main.apps.leftover.win.default_reason', { label }),
    risk: tk('main.apps.leftover.win.default_risk')
  }
}
