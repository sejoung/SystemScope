import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir } from 'node:os'
import type { StartupItem } from '@shared/types'
import { runExternalCommand, isExternalCommandError } from '@main/services/core/externalCommand'
import { logDebug } from '@main/services/core/logging'
import { startupItemId } from './startupItemId'

const REG_TIMEOUT_MS = 10000

export async function getWindowsStartupItems(): Promise<StartupItem[]> {
  const items: StartupItem[] = []

  // Registry: HKCU\...\Run
  await scanWindowsRegistry('HKCU', items, true)
  await scanWindowsRegistry('HKCU', items, false)
  // Registry: HKLM\...\Run
  await scanWindowsRegistry('HKLM', items, true)
  await scanWindowsRegistry('HKLM', items, false)
  // Startup folder
  await scanWindowsStartupFolder(items)

  return items
}

async function scanWindowsRegistry(hive: 'HKCU' | 'HKLM', items: StartupItem[], enabled: boolean): Promise<void> {
  const scope = hive === 'HKCU' ? 'user' : 'system'
  const activePath = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`
  const regPath = enabled ? activePath : `${activePath}Disabled`

  try {
    const { stdout } = await runExternalCommand('reg', ['query', regPath], { timeout: REG_TIMEOUT_MS })
    const lines = stdout.split('\n').filter((l) => l.trim() && !l.trim().startsWith(regPath))

    for (const line of lines) {
      const match = line.trim().match(/^(\S+)\s+REG_SZ\s+(.+)$/)
      if (!match) continue

      const name = match[1]
      const value = match[2].trim()

      items.push({
        id: startupItemId(`${activePath}\\${name}`),
        name,
        path: value,
        type: 'registry_run',
        scope,
        enabled,
        label: name,
        description: value,
      })
    }
  } catch (err) {
    if (isExternalCommandError(err) && err.kind !== 'command_not_found') {
      logDebug('startup-manager', `Failed to query registry: ${regPath}`, { error: err })
    }
  }
}

async function scanWindowsStartupFolder(items: StartupItem[]): Promise<void> {
  const startupDir = path.win32.join(
    process.env.APPDATA || path.win32.join(homedir(), 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
  )

  await scanStartupDirectory(startupDir, startupDir, true, items)
  await scanStartupDirectory(path.win32.join(startupDir, '_disabled'), startupDir, false, items)
}

async function scanStartupDirectory(
  scanDir: string,
  activeDir: string,
  enabled: boolean,
  items: StartupItem[]
): Promise<void> {
  try {
    const entries = await fs.readdir(scanDir)
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === '_disabled') continue
      const fullPath = path.win32.join(scanDir, entry)
      items.push({
        id: startupItemId(path.win32.join(activeDir, entry)),
        name: entry.replace(/\.(lnk|url)$/i, ''),
        path: fullPath,
        type: 'startup_folder',
        scope: 'user',
        enabled,
        label: entry,
        description: fullPath,
      })
    }
  } catch {
    // Startup folder not accessible
  }
}

export async function toggleWindowsItem(item: StartupItem, enabled: boolean): Promise<void> {
  if (item.type === 'registry_run') {
    const hive = item.scope === 'user' ? 'HKCU' : 'HKLM'
    const regPath = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`

    if (enabled) {
      // Re-add the registry entry
      await runExternalCommand('reg', ['add', regPath, '/v', item.name, '/t', 'REG_SZ', '/d', item.path, '/f'], { timeout: REG_TIMEOUT_MS })
      await runExternalCommand('reg', ['delete', `${regPath}Disabled`, '/v', item.name, '/f'], { timeout: REG_TIMEOUT_MS })
    } else {
      // Remove the registry entry (backup to RunDisabled)
      const disabledPath = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\RunDisabled`
      await runExternalCommand('reg', ['add', disabledPath, '/v', item.name, '/t', 'REG_SZ', '/d', item.path, '/f'], { timeout: REG_TIMEOUT_MS })
      await runExternalCommand('reg', ['delete', regPath, '/v', item.name, '/f'], { timeout: REG_TIMEOUT_MS })
    }
  } else if (item.type === 'startup_folder') {
    if (enabled) {
      const disabledDir = path.win32.dirname(item.path)
      const startupDir = path.win32.dirname(disabledDir)
      await fs.rename(item.path, path.win32.join(startupDir, path.win32.basename(item.path)))
    } else {
      // Move to a disabled subfolder
      const dir = path.win32.dirname(item.path)
      const disabledDir = path.win32.join(dir, '_disabled')
      await fs.mkdir(disabledDir, { recursive: true })
      await fs.rename(item.path, path.win32.join(disabledDir, path.win32.basename(item.path)))
    }
  }
}
