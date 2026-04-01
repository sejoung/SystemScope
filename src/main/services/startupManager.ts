import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir, platform } from 'node:os'
import { createHash } from 'node:crypto'
import type { StartupItem, StartupToggleResult } from '@shared/types'
import { runExternalCommand, isExternalCommandError } from './externalCommand'
import { logInfo, logError, logDebug } from './logging'

export async function getStartupItems(): Promise<StartupItem[]> {
  const p = platform()
  if (p === 'darwin') return getMacStartupItems()
  if (p === 'win32') return getWindowsStartupItems()
  return []
}

export async function toggleStartupItem(id: string, enabled: boolean): Promise<StartupToggleResult> {
  const items = await getStartupItems()
  const item = items.find((i) => i.id === id)
  if (!item) {
    return { id, enabled, success: false, error: 'Startup item not found' }
  }

  const p = platform()
  try {
    if (p === 'darwin') {
      await toggleMacItem(item, enabled)
    } else if (p === 'win32') {
      await toggleWindowsItem(item, enabled)
    }
    logInfo('startup-manager', `Startup item ${enabled ? 'enabled' : 'disabled'}: ${item.name}`, { id, path: item.path })
    return { id, enabled, success: true, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to toggle startup item'
    logError('startup-manager', 'Failed to toggle startup item', { id, error: err })
    return { id, enabled, success: false, error: message }
  }
}

// ── macOS ──

async function getMacStartupItems(): Promise<StartupItem[]> {
  const items: StartupItem[] = []
  const home = homedir()

  // User Launch Agents
  const userAgentsDir = path.join(home, 'Library', 'LaunchAgents')
  await scanPlistDir(userAgentsDir, 'launch_agent', 'user', items)

  // System Launch Agents
  await scanPlistDir('/Library/LaunchAgents', 'launch_agent', 'system', items)

  // System Launch Daemons
  await scanPlistDir('/Library/LaunchDaemons', 'launch_daemon', 'system', items)

  return items
}

async function scanPlistDir(
  dirPath: string,
  type: 'launch_agent' | 'launch_daemon',
  scope: 'user' | 'system',
  items: StartupItem[]
): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath)
    for (const entry of entries) {
      if (!entry.endsWith('.plist')) continue
      const fullPath = path.join(dirPath, entry)
      try {
        const info = await parsePlist(fullPath)
        const label = info.label || entry.replace('.plist', '')
        const disabled = info.disabled === true

        items.push({
          id: createHash('sha256').update(fullPath).digest('hex').slice(0, 16),
          name: label,
          path: fullPath,
          type,
          scope,
          enabled: !disabled,
          label,
          description: info.program || info.programArguments?.[0] || null,
        })
      } catch {
        logDebug('startup-manager', 'Skipping unparseable plist', { path: fullPath })
      }
    }
  } catch {
    // Directory not accessible or doesn't exist
  }
}

interface PlistInfo {
  label?: string
  disabled?: boolean
  program?: string
  programArguments?: string[]
}

async function parsePlist(plistPath: string): Promise<PlistInfo> {
  // Use plutil to convert plist to JSON
  const { stdout } = await runExternalCommand('plutil', ['-convert', 'json', '-o', '-', plistPath], { timeout: 5000 })
  const data = JSON.parse(stdout) as Record<string, unknown>
  return {
    label: typeof data.Label === 'string' ? data.Label : undefined,
    disabled: data.Disabled === true,
    program: typeof data.Program === 'string' ? data.Program : undefined,
    programArguments: Array.isArray(data.ProgramArguments) ? data.ProgramArguments.filter((a): a is string => typeof a === 'string') : undefined,
  }
}

async function toggleMacItem(item: StartupItem, enabled: boolean): Promise<void> {
  if (item.type === 'launch_agent' || item.type === 'launch_daemon') {
    // Read current plist, set Disabled key, write back
    const { stdout } = await runExternalCommand('plutil', ['-convert', 'json', '-o', '-', item.path], { timeout: 5000 })
    const data = JSON.parse(stdout) as Record<string, unknown>

    if (enabled) {
      delete data.Disabled
    } else {
      data.Disabled = true
    }

    // Write back via plutil
    const jsonStr = JSON.stringify(data)
    await runExternalCommand('plutil', ['-convert', 'xml1', '-o', item.path, '-'], {
      timeout: 5000,
      // Pass JSON via stdin isn't supported by execFile, so write temp file
    }).catch(async () => {
      // Fallback: write JSON then convert
      const tmpPath = item.path + '.tmp.json'
      await fs.writeFile(tmpPath, jsonStr, 'utf-8')
      await runExternalCommand('plutil', ['-convert', 'xml1', tmpPath, '-o', item.path], { timeout: 5000 })
      await fs.unlink(tmpPath).catch(() => {})
    })

    // Load/unload the agent
    if (item.scope === 'user') {
      try {
        if (enabled) {
          await runExternalCommand('launchctl', ['load', item.path], { timeout: 5000 })
        } else {
          await runExternalCommand('launchctl', ['unload', item.path], { timeout: 5000 })
        }
      } catch {
        // launchctl may fail if already loaded/unloaded — acceptable
      }
    }
  }
}

// ── Windows ──

async function getWindowsStartupItems(): Promise<StartupItem[]> {
  const items: StartupItem[] = []

  // Registry: HKCU\...\Run
  await scanWindowsRegistry('HKCU', items)
  // Registry: HKLM\...\Run
  await scanWindowsRegistry('HKLM', items)
  // Startup folder
  await scanWindowsStartupFolder(items)

  return items
}

async function scanWindowsRegistry(hive: 'HKCU' | 'HKLM', items: StartupItem[]): Promise<void> {
  const scope = hive === 'HKCU' ? 'user' : 'system'
  const regPath = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`

  try {
    const { stdout } = await runExternalCommand('reg', ['query', regPath], { timeout: 10000 })
    const lines = stdout.split('\n').filter((l) => l.trim() && !l.trim().startsWith(regPath))

    for (const line of lines) {
      const match = line.trim().match(/^(\S+)\s+REG_SZ\s+(.+)$/)
      if (!match) continue

      const name = match[1]
      const value = match[2].trim()

      items.push({
        id: createHash('sha256').update(`${regPath}\\${name}`).digest('hex').slice(0, 16),
        name,
        path: value,
        type: 'registry_run',
        scope,
        enabled: true,
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
  const startupDir = path.join(
    process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
  )

  try {
    const entries = await fs.readdir(startupDir)
    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const fullPath = path.join(startupDir, entry)
      items.push({
        id: createHash('sha256').update(fullPath).digest('hex').slice(0, 16),
        name: entry.replace(/\.(lnk|url)$/i, ''),
        path: fullPath,
        type: 'startup_folder',
        scope: 'user',
        enabled: true,
        label: entry,
        description: fullPath,
      })
    }
  } catch {
    // Startup folder not accessible
  }
}

async function toggleWindowsItem(item: StartupItem, enabled: boolean): Promise<void> {
  if (item.type === 'registry_run') {
    const hive = item.scope === 'user' ? 'HKCU' : 'HKLM'
    const regPath = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`

    if (enabled) {
      // Re-add the registry entry
      await runExternalCommand('reg', ['add', regPath, '/v', item.name, '/t', 'REG_SZ', '/d', item.path, '/f'], { timeout: 10000 })
    } else {
      // Remove the registry entry (backup to RunDisabled)
      const disabledPath = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\RunDisabled`
      await runExternalCommand('reg', ['add', disabledPath, '/v', item.name, '/t', 'REG_SZ', '/d', item.path, '/f'], { timeout: 10000 })
      await runExternalCommand('reg', ['delete', regPath, '/v', item.name, '/f'], { timeout: 10000 })
    }
  } else if (item.type === 'startup_folder') {
    if (enabled) {
      // Cannot re-enable a deleted shortcut — would need backup
      throw new Error('Cannot re-enable startup folder items')
    } else {
      // Move to a disabled subfolder
      const dir = path.dirname(item.path)
      const disabledDir = path.join(dir, '_disabled')
      await fs.mkdir(disabledDir, { recursive: true })
      await fs.rename(item.path, path.join(disabledDir, path.basename(item.path)))
    }
  }
}
