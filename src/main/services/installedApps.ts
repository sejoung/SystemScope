import { app, shell } from 'electron'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { homedir, platform as getPlatform } from 'os'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import type { AppLeftoverDataItem, AppRelatedDataItem, AppRemovalResult, AppUninstallRequest, InstalledApp } from '@shared/types'
import { logDebug, logError, logInfo, logWarn } from './logging'

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
    throw new Error('설치 앱 정보를 찾을 수 없습니다.')
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
    throw new Error('설치 앱 정보를 찾을 수 없습니다.')
  }

  const targetPath = target.platform === 'mac'
    ? target.launchPath
    : target.installLocation || target.launchPath

  if (!targetPath) {
    throw new Error('열 수 있는 설치 경로가 없습니다.')
  }

  const openResult = await shell.openPath(targetPath)
  if (openResult) {
    throw new Error(openResult)
  }
}

export async function openSystemUninstallSettings(): Promise<void> {
  if (getPlatform() !== 'win32') {
    throw new Error('현재 운영체제에서는 지원되지 않습니다.')
  }

  await shell.openExternal('ms-settings:appsfeatures')
}

export async function uninstallInstalledApp(request: AppUninstallRequest): Promise<AppRemovalResult> {
  const target = installedAppsCache.get(request.appId)
  if (!target) {
    throw new Error('설치 앱 정보를 찾을 수 없습니다.')
  }

  if (target.protected) {
    throw new Error(target.protectedReason ?? '보호된 항목은 제거할 수 없습니다.')
  }

  if (target.platform === 'mac') {
    if (!target.launchPath) {
      throw new Error('삭제할 앱 경로를 찾을 수 없습니다.')
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
      message: buildRemovalMessage('앱을 휴지통으로 이동했습니다.', relatedCleanup.deletedPaths.length, relatedCleanup.failedPaths.length),
      relatedDataDeletedCount: relatedCleanup.deletedPaths.length,
      relatedDataFailedPaths: relatedCleanup.failedPaths
    }
  }

  if (!target.uninstallCommand) {
    throw new Error('실행 가능한 제거 명령이 없습니다.')
  }

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
    message: buildRemovalMessage('제거 프로그램을 시작했습니다.', relatedCleanup.deletedPaths.length, relatedCleanup.failedPaths.length),
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
      protectedReason: isProtected ? '현재 실행 중인 SystemScope는 제거할 수 없습니다.' : undefined
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
        protectedReason: protectedApp ? '시스템 앱 또는 현재 실행 중인 앱은 삭제할 수 없습니다.' : undefined
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
      const { stdout } = await execFileAsync('reg', ['query', registryPath, '/s'])
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

function launchWindowsUninstaller(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, [], {
        shell: true,
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      })
      child.on('error', reject)
      child.unref()
      resolve()
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
    return `${baseMessage} 관련 데이터 ${deletedCount}개도 함께 휴지통으로 이동했습니다.`
  }

  return `${baseMessage} 관련 데이터 ${deletedCount}개를 함께 이동했고 ${failedCount}개는 이동하지 못했습니다.`
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
      reason: `표준 macOS ${label.toLowerCase()} 경로에 있고 설치된 앱 번들과 일치 항목이 없습니다.`,
      risk: '앱을 더 이상 쓰지 않는다면 지워도 될 가능성이 높지만, 로그인 상태나 샌드박스 데이터가 사라질 수 있습니다.'
    }
  }

  if (label === 'Preferences') {
    return {
      confidence: appName.includes('.') ? 'high' : 'medium',
      reason: appName.includes('.')
        ? 'bundle id 형태의 환경설정 파일이며 설치된 앱과 일치 항목이 없습니다.'
        : '환경설정 파일이지만 이름 기반으로만 추정했습니다.',
      risk: '설정값만 지워질 가능성이 높지만, 앱 재설치 후 기존 설정을 복구하지 못할 수 있습니다.'
    }
  }

  if (label === 'Application Support') {
    return {
      confidence: 'medium',
      reason: '표준 앱 데이터 경로에 있지만 이름 기반으로 분류된 항목입니다.',
      risk: '앱 데이터, 다운로드, 내부 DB가 포함될 수 있어 삭제 전 경로 확인이 필요합니다.'
    }
  }

  return {
    confidence: 'medium',
    reason: `표준 ${label.toLowerCase()} 경로에 있는 항목이지만 이름 기반 후보입니다.`,
    risk: '캐시/로그 성격일 가능성이 높지만 일부 재사용 데이터가 섞여 있을 수 있습니다.'
  }
}

function getWindowsLeftoverGuidance(
  label: AppLeftoverDataItem['label']
): Pick<AppLeftoverDataItem, 'confidence' | 'reason' | 'risk'> {
  if (label === 'ProgramData') {
    return {
      confidence: 'medium',
      reason: '공용 프로그램 데이터 경로에 있고 설치된 프로그램 목록과 일치 항목이 없습니다.',
      risk: '공용 설정이나 서비스 데이터가 남아 있을 수 있어 삭제 전 확인이 필요합니다.'
    }
  }

  if (label === 'Local Programs') {
    return {
      confidence: 'high',
      reason: '사용자 로컬 프로그램 경로에 있지만 설치 목록과 일치 항목이 없습니다.',
      risk: '앱을 더 이상 쓰지 않는다면 삭제해도 될 가능성이 높지만 휴대용 앱일 수도 있습니다.'
    }
  }

  return {
    confidence: 'medium',
    reason: `표준 ${label} 경로에 있지만 설치 목록과 이름 기반으로만 비교된 항목입니다.`,
    risk: '캐시나 설정일 수 있지만 일부 앱은 재설치 시 재사용할 데이터가 포함될 수 있습니다.'
  }
}
