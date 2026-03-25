import { existsSync } from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import type { AppLeftoverDataItem, AppLeftoverRegistryItem, AppRelatedDataItem, InstalledApp } from '@shared/types'
import { logError, logInfo, logWarn } from './logging'
import { tk } from '../i18n'
import { getDirSize } from '../utils/getDirSize'

const execFileAsync = promisify(execFile)
const leftoverSizeCache = new Map<string, number>()
const MAX_SIZE_MEASUREMENTS_PER_SCAN = 12

export async function listWindowsInstalledApps(): Promise<InstalledApp[]> {
  const registryRoots = [
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ]

  const allApps: InstalledApp[] = []
  for (const registryPath of registryRoots) {
    try {
      const psCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; reg query "${registryPath}" /s`
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      })
      const parsed = parseWindowsRegistryOutput(stdout)
      allApps.push(...parsed)
      logInfo('apps', 'Queried Windows uninstall registry root', {
        registryPath,
        count: parsed.length
      })
    } catch (error) {
      logWarn('apps', 'Failed to query Windows uninstall registry', { registryPath, error })
    }
  }

  logInfo('apps', 'Loaded Windows uninstall registry apps', {
    count: allApps.length
  })

  return allApps
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
      uninstallRegistryPath: registryPath,
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

export async function listWindowsLeftoverRegistryEntries(): Promise<AppLeftoverRegistryItem[]> {
  const entries = await listWindowsInstalledApps()
  const leftovers: AppLeftoverRegistryItem[] = []

  for (const entry of entries) {
    const installLocationExists = entry.installLocation ? pathExists(entry.installLocation) : false
    const uninstallerExists = entry.uninstallCommand ? commandTargetExists(entry.uninstallCommand) : false

    if (installLocationExists || uninstallerExists) {
      continue
    }

    const registryPath = entry.uninstallRegistryPath ?? entry.id
    leftovers.push({
      id: registryPath,
      appName: entry.name,
      registryPath,
      version: entry.version,
      publisher: entry.publisher,
      installLocation: entry.installLocation,
      uninstallCommand: entry.uninstallCommand,
      installLocationExists,
      uninstallerExists
    })
  }

  logInfo('apps', 'Filtered Windows leftover uninstall registry entries', {
    scannedCount: entries.length,
    leftoverCount: leftovers.length
  })

  return leftovers
}

export async function launchWindowsUninstaller(command: string): Promise<void> {
  try {
    const { file, args } = parseUninstallCommand(command)
    const argv = splitWindowsCommandArgs(args)
    const psCommand = buildWindowsUninstallerPowerShellCommand(file, argv)

    logInfo('apps', 'Launching uninstaller process', { file, args: argv, psCommand })

    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
      windowsHide: false
    })
  } catch (error) {
    logError('apps', 'Failed to start Windows uninstall command', { command, error })
    throw error
  }
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

  return dedupeByPath(candidates)
}

export async function listWindowsLeftoverAppData(installedApps: InstalledApp[]): Promise<AppLeftoverDataItem[]> {
  const knownNames = new Set(installedApps.flatMap((a) => {
    const values = [a.name]
    if (a.installLocation) values.push(path.win32.basename(a.installLocation))
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
      const targetPath = path.win32.join(spec.root, entry.name)

      items.push({
        id: `${spec.source}:${targetPath}`,
        appName,
        label: spec.label,
        path: targetPath,
        source: spec.source,
        platform: 'windows',
        ...getWindowsLeftoverGuidance(spec.label)
      })
    }
  }

  const dedupedItems = dedupeLeftoverByPath(items)
  await hydrateLeftoverSizes(dedupedItems, (item) => getDirSize(item.path))
  return dedupedItems
}

// ─── Exported helpers (used in tests) ───

export function parseUninstallCommand(command: string): { file: string; args: string } {
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
  return [
    '$ErrorActionPreference = \'Stop\'',
    `$process = Start-Process -FilePath '${escapedFile}' ${argListLiteral} -WorkingDirectory '${path.dirname(escapedFile)}' -Verb RunAs -PassThru`,
    'if ($null -eq $process) { throw \'Failed to launch uninstaller process.\' }'
  ].join('; ')
}

// ─── Internal helpers ───

function sanitizeRegistryValue(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

function pathExists(targetPath: string): boolean {
  if (!targetPath.trim()) return false
  return existsSync(expandWindowsEnvVars(targetPath))
}

function commandTargetExists(command: string): boolean {
  const { file } = parseUninstallCommand(expandWindowsEnvVars(command))
  const normalized = file.trim().replace(/^"(.*)"$/, '$1')
  if (!normalized) return false

  const lower = normalized.toLowerCase()
  if (lower === 'msiexec' || lower === 'msiexec.exe' || lower === 'rundll32' || lower === 'rundll32.exe') {
    return true
  }

  if (!/[\\/]/.test(normalized)) {
    return true
  }

  return existsSync(normalized)
}

function expandWindowsEnvVars(input: string): string {
  return input.replace(/%([^%]+)%/g, (_match, name: string) => process.env[name] ?? `%${name}%`)
}

function currentExeIfInside(currentExe: string, installLocation: string): string | undefined {
  const normalizedInstall = installLocation.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase()
  const normalizedExe = currentExe.replace(/[\\/]+/g, '\\').toLowerCase()
  return normalizedExe.startsWith(normalizedInstall) ? currentExe : undefined
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

function createRelatedDataItem(itemPath: string, label: string, source: string): AppRelatedDataItem {
  return {
    id: `${source}:${itemPath}`,
    label,
    path: itemPath,
    source
  }
}

function dedupeByPath(items: AppRelatedDataItem[]): AppRelatedDataItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })
}

function dedupeLeftoverByPath(items: AppLeftoverDataItem[]): AppLeftoverDataItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })
}

async function hydrateLeftoverSizes(
  items: AppLeftoverDataItem[],
  measure: (item: AppLeftoverDataItem) => Promise<number>
): Promise<void> {
  for (const item of items) {
    const cachedSize = leftoverSizeCache.get(item.path)
    if (cachedSize !== undefined) {
      item.sizeBytes = cachedSize
    }
  }

  const pendingItems = items
    .filter((item) => item.sizeBytes === undefined)
    .sort((left, right) => confidenceRank(left.confidence) - confidenceRank(right.confidence) || left.appName.localeCompare(right.appName))
    .slice(0, MAX_SIZE_MEASUREMENTS_PER_SCAN)

  for (const item of pendingItems) {
    const sizeBytes = await measure(item)
    leftoverSizeCache.set(item.path, sizeBytes)
    item.sizeBytes = sizeBytes
  }
}

function confidenceRank(confidence: AppLeftoverDataItem['confidence']): number {
  switch (confidence) {
    case 'high':
      return 0
    case 'medium':
      return 1
    case 'low':
      return 2
  }
}
