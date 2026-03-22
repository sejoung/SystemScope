import { app, shell } from 'electron'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { homedir, platform as getPlatform } from 'os'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import type { AppRemovalResult, InstalledApp } from '@shared/types'
import { logDebug, logError, logInfo, logWarn } from './logging'

const execFileAsync = promisify(execFile)
const installedAppsCache = new Map<string, InstalledApp>()

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

export async function uninstallInstalledApp(appId: string): Promise<AppRemovalResult> {
  const target = installedAppsCache.get(appId)
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

    try {
      await shell.trashItem(target.launchPath)
    } catch (error) {
      logInfo('apps', 'shell.trashItem failed for macOS app, trying Finder fallback', {
        appId,
        name: target.name,
        path: target.launchPath,
        error
      })
      await moveMacAppToTrashWithFinder(target.launchPath)
    }
    installedAppsCache.delete(appId)
    logInfo('apps', 'Moved macOS app bundle to trash', { appId, name: target.name, path: target.launchPath })
    return {
      id: target.id,
      name: target.name,
      started: true,
      completed: true,
      cancelled: false,
      message: '앱을 휴지통으로 이동했습니다.'
    }
  }

  if (!target.uninstallCommand) {
    throw new Error('실행 가능한 제거 명령이 없습니다.')
  }

  await launchWindowsUninstaller(target.uninstallCommand)
  logInfo('apps', 'Started Windows uninstall command', { appId, name: target.name })
  return {
    id: target.id,
    name: target.name,
    started: true,
    completed: false,
    cancelled: false,
    message: '제거 프로그램을 시작했습니다.'
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
    let entries: Awaited<ReturnType<typeof fsp.readdir>>
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

  try {
    const { stdout: version } = await execFileAsync('defaults', ['read', plistPath, 'CFBundleShortVersionString'])
    const { stdout: bundleId } = await execFileAsync('defaults', ['read', plistPath, 'CFBundleIdentifier'])
    return {
      name: fallbackName,
      version: version.trim() || undefined,
      bundleId: bundleId.trim() || undefined
    }
  } catch (error) {
    logDebug('apps', 'macOS app metadata unavailable, using bundle name fallback', { appPath, error })
    return { name: fallbackName }
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
