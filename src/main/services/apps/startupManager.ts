import { shell } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir, platform, tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import type { StartupItem, StartupToggleResult, OrphanedLaunchAgent, RemoveOrphanedResult } from '@shared/types'
import { runExternalCommand, isExternalCommandError } from '@main/services/core/externalCommand'
import { logInfo, logWarn, logError, logDebug } from '@main/services/core/logging'

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

// ── Orphaned LaunchAgents / LaunchDaemons (macOS) ──
//
// A leftover launchd plist is one whose target no longer exists — typically left behind
// after an app is deleted, so it fails silently at every login/boot. We flag two
// high-confidence cases to avoid false positives: an absolute Program / first
// ProgramArguments path that's missing, or a plist that is itself a broken symlink
// (e.g. an uninstaller removed the app but not the link in /Library/LaunchAgents).
// User-scope entries are trashed directly; system-scope entries (/Library) are removed
// through a single osascript "with administrator privileges" prompt.

const USER_LAUNCH_AGENTS_DIR = path.join(homedir(), 'Library', 'LaunchAgents')
const SYSTEM_LAUNCH_AGENTS_DIR = '/Library/LaunchAgents'
const SYSTEM_LAUNCH_DAEMONS_DIR = '/Library/LaunchDaemons'

interface OrphanScanLocation {
  dir: string
  kind: 'launch_agent' | 'launch_daemon'
  scope: 'user' | 'system'
}

const ORPHAN_SCAN_LOCATIONS: OrphanScanLocation[] = [
  { dir: USER_LAUNCH_AGENTS_DIR, kind: 'launch_agent', scope: 'user' },
  { dir: SYSTEM_LAUNCH_AGENTS_DIR, kind: 'launch_agent', scope: 'system' },
  { dir: SYSTEM_LAUNCH_DAEMONS_DIR, kind: 'launch_daemon', scope: 'system' },
]

export async function findOrphanedLaunchAgents(): Promise<OrphanedLaunchAgent[]> {
  if (platform() !== 'darwin') return []

  const orphans: OrphanedLaunchAgent[] = []
  const bundleIdCache = new Map<string, boolean>()
  for (const location of ORPHAN_SCAN_LOCATIONS) {
    await scanLocationForOrphans(location, orphans, bundleIdCache)
  }

  logInfo('startup-manager', 'Orphaned LaunchAgent scan completed', { count: orphans.length })
  return orphans
}

/**
 * Whether an app with this bundle id is installed, resolved via Spotlight.
 * Errs on the side of "installed" (never flag) when mdfind is unavailable or fails.
 */
async function isBundleIdInstalled(bundleId: string, cache: Map<string, boolean>): Promise<boolean> {
  const cached = cache.get(bundleId)
  if (cached !== undefined) return cached
  let installed: boolean
  try {
    const { stdout } = await runExternalCommand('mdfind', [`kMDItemCFBundleIdentifier == "${bundleId}"`], { timeout: 10000 })
    installed = stdout.trim().length > 0
  } catch {
    installed = true
  }
  cache.set(bundleId, installed)
  return installed
}

/** Executable locations that only exist as helpers installed on behalf of an app. */
function isAppHelperExecutable(executable: string): boolean {
  return (
    executable.startsWith('/Library/PrivilegedHelperTools/') ||
    executable.startsWith('/Library/Application Support/') ||
    executable.startsWith(path.join(homedir(), 'Library', 'Application Support') + '/')
  )
}

/** "com.adobe.ARMDC.Communicator" → "com.adobe.*", or null when the label isn't reverse-DNS enough to infer a vendor. */
function vendorGlobForLabel(label: string): string | null {
  const segments = label.split('.')
  if (segments.length < 3) return null
  return `${segments[0]}.${segments[1]}.*`
}

/**
 * Whether the vendor still has any app in /Applications or ~/Applications.
 * Deliberately scoped to the app folders: leftover helper bundles under
 * /Library/Application Support (e.g. Adobe's Acrobat Update Helper.app) would
 * otherwise match their own vendor glob and mask the orphan.
 */
async function vendorAppInstalled(vendorGlob: string, cache: Map<string, boolean>): Promise<boolean> {
  const cached = cache.get(vendorGlob)
  if (cached !== undefined) return cached
  let installed: boolean
  try {
    const { stdout } = await runExternalCommand(
      'mdfind',
      ['-onlyin', '/Applications', '-onlyin', path.join(homedir(), 'Applications'), `kMDItemCFBundleIdentifier == "${vendorGlob}"`],
      { timeout: 10000 }
    )
    installed = stdout.trim().length > 0
  } catch {
    installed = true // err on the side of "installed" → never flag
  }
  cache.set(vendorGlob, installed)
  return installed
}

async function scanLocationForOrphans(
  location: OrphanScanLocation,
  orphans: OrphanedLaunchAgent[],
  bundleIdCache: Map<string, boolean>
): Promise<void> {
  let entries: string[]
  try {
    entries = await fs.readdir(location.dir)
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.endsWith('.plist')) continue
    if (entry.startsWith('com.apple.')) continue // Apple-managed entries are off-limits
    const plistPath = path.join(location.dir, entry)
    try {
      const stats = await fs.lstat(plistPath)
      if (stats.isSymbolicLink()) {
        try {
          await fs.access(plistPath) // follows the link
        } catch {
          // Broken symlink — the app bundle the link pointed into is gone.
          const target = await fs.readlink(plistPath).catch(() => '')
          orphans.push({
            id: createHash('sha256').update(plistPath).digest('hex').slice(0, 16),
            label: entry.replace('.plist', ''),
            plistPath,
            missingExecutable: target || plistPath,
            scope: location.scope,
            kind: location.kind,
            reason: 'broken_symlink',
          })
          continue
        }
      }

      const info = await parsePlist(plistPath)
      const label = info.label || entry.replace('.plist', '')
      // Apple-managed agents are off-limits.
      if (label.startsWith('com.apple.')) continue

      const executable = resolveLaunchAgentExecutable(info)
      if (!executable) continue // can't determine the binary → never flag

      let reason: OrphanedLaunchAgent['reason'] = 'missing_executable'
      let missingTarget = executable
      try {
        await fs.access(executable)
        // Executable exists — lower-confidence checks for "the owning app is gone".
        const bundleIds = info.associatedBundleIdentifiers?.filter((b) => !b.startsWith('com.apple.')) ?? []
        if (bundleIds.length > 0) {
          // The plist declares which app it belongs to (AssociatedBundleIdentifiers)
          // (e.g. Wireshark's ChmodBPF daemon outliving Wireshark.app).
          const checks = await Promise.all(bundleIds.map((b) => isBundleIdInstalled(b, bundleIdCache)))
          if (checks.some(Boolean)) continue // any owning app still installed → not orphaned
          missingTarget = bundleIds.join(', ')
        } else if (isAppHelperExecutable(executable)) {
          // No declared app, but the executable is a helper that only an app would have
          // installed (e.g. Adobe's ARMDC updater outliving Acrobat). Flag it when the
          // vendor no longer has any app in the app folders.
          const vendorGlob = vendorGlobForLabel(label)
          if (!vendorGlob) continue
          if (await vendorAppInstalled(vendorGlob, bundleIdCache)) continue
          missingTarget = vendorGlob
        } else {
          continue
        }
        reason = 'missing_app'
      } catch {
        // missing executable → orphaned
      }

      orphans.push({
        id: createHash('sha256').update(plistPath).digest('hex').slice(0, 16),
        label,
        plistPath,
        missingExecutable: missingTarget,
        scope: location.scope,
        kind: location.kind,
        reason,
      })
    } catch {
      logDebug('startup-manager', 'Skipping unparseable plist during orphan scan', { path: plistPath })
    }
  }
}

/** Resolve the absolute executable a LaunchAgent points at, or null when it can't be determined safely. */
function resolveLaunchAgentExecutable(info: PlistInfo): string | null {
  let candidate = info.program ?? info.programArguments?.[0]
  if (!candidate) return null
  if (candidate.startsWith('~')) {
    candidate = path.join(homedir(), candidate.slice(1))
  }
  // Only absolute paths are confidently checkable; bare commands resolve via PATH.
  if (!candidate.startsWith('/')) return null
  return candidate
}

const ALLOWED_ORPHAN_DIRS = new Set(ORPHAN_SCAN_LOCATIONS.map((l) => l.dir))

export async function removeOrphanedLaunchAgents(ids: string[]): Promise<RemoveOrphanedResult> {
  const result: RemoveOrphanedResult = { removedCount: 0, failedCount: 0, removedPaths: [], errors: [] }

  // Re-scan and only act on ids that are still genuinely orphaned (containment).
  const current = await findOrphanedLaunchAgents()
  const byId = new Map(current.map((o) => [o.id, o]))

  const systemOrphans: OrphanedLaunchAgent[] = []
  for (const id of ids) {
    const orphan = byId.get(id)
    if (!orphan) {
      result.failedCount++
      continue
    }

    // Defense in depth: only ever touch files directly inside the scanned launchd directories.
    const resolved = path.resolve(orphan.plistPath)
    if (!ALLOWED_ORPHAN_DIRS.has(path.dirname(resolved))) {
      result.failedCount++
      result.errors.push(`${orphan.label}: outside managed launchd directories`)
      logWarn('startup-manager', 'Rejected orphan removal outside managed launchd directories', { path: resolved })
      continue
    }

    if (orphan.scope === 'system') {
      systemOrphans.push({ ...orphan, plistPath: resolved })
      continue
    }

    try {
      // Best-effort unload so launchd stops referencing it; ignore failures.
      await runExternalCommand('launchctl', ['unload', resolved], { timeout: 5000 }).catch(() => {})
      try {
        await shell.trashItem(resolved)
      } catch (trashErr) {
        // Finder can refuse to trash a broken symlink; removing the dead link is equivalent.
        if (orphan.reason !== 'broken_symlink') throw trashErr
        await fs.unlink(resolved)
      }
      result.removedCount++
      result.removedPaths.push(resolved)
    } catch (err) {
      result.failedCount++
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`${orphan.label}: ${message}`)
      logError('startup-manager', 'Failed to remove orphaned LaunchAgent', { path: resolved, error: err })
    }
  }

  if (systemOrphans.length > 0) {
    await removeSystemOrphansWithAdmin(systemOrphans, result)
  }

  logInfo('startup-manager', 'Orphaned LaunchAgent removal completed', {
    removedCount: result.removedCount,
    failedCount: result.failedCount,
  })
  return result
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Run a shell script through a single macOS administrator password prompt.
 * The script is passed via argv (not interpolated into the AppleScript source)
 * so no AppleScript string escaping is needed. Throws a friendly error when the
 * user dismisses the password dialog.
 */
async function runAdminShellScript(script: string): Promise<void> {
  try {
    await runExternalCommand(
      'osascript',
      [
        '-e', 'on run argv',
        '-e', 'do shell script (item 1 of argv) with administrator privileges',
        '-e', 'end run',
        script,
      ],
      { timeout: 120000 } // generous: waits on the user typing their password
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('User canceled') || message.includes('-128')) {
      throw new Error('Administrator authorization was canceled', { cause: err })
    }
    throw err
  }
}

/**
 * Remove system-scope orphans (/Library/LaunchAgents, /Library/LaunchDaemons) in one batch.
 * These are root-owned, so the whole script runs through a single macOS administrator
 * password prompt (osascript "with administrator privileges"). Files are moved to the
 * user's Trash and chowned back so they can be inspected or restored.
 */
async function removeSystemOrphansWithAdmin(orphans: OrphanedLaunchAgent[], result: RemoveOrphanedResult): Promise<void> {
  const trashDir = path.join(homedir(), '.Trash')
  const uid = process.getuid?.() ?? 0
  const gid = process.getgid?.() ?? 0

  const lines: string[] = []
  for (const orphan of orphans) {
    const base = path.basename(orphan.plistPath, '.plist')
    const trashPath = path.join(trashDir, `${base}.${Date.now().toString(36)}.plist`)
    if (orphan.kind === 'launch_daemon') {
      // Best-effort: stop launchd from referencing the daemon before removal.
      lines.push(`launchctl bootout system ${shellQuote(orphan.plistPath)} 2>/dev/null || true`)
    }
    lines.push(`mv -f ${shellQuote(orphan.plistPath)} ${shellQuote(trashPath)}`)
    lines.push(`chown -h ${uid}:${gid} ${shellQuote(trashPath)} 2>/dev/null || true`)
  }

  try {
    await runAdminShellScript(lines.join('\n'))
    for (const orphan of orphans) {
      result.removedCount++
      result.removedPaths.push(orphan.plistPath)
    }
    logInfo('startup-manager', 'Removed system-scope orphaned launchd items', { count: orphans.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const canceled = message.includes('canceled')
    for (const orphan of orphans) {
      result.failedCount++
      result.errors.push(`${orphan.label}: ${canceled ? 'administrator authorization canceled' : message}`)
    }
    if (canceled) {
      logInfo('startup-manager', 'System orphan removal canceled by user at admin prompt', { count: orphans.length })
    } else {
      logError('startup-manager', 'Failed to remove system-scope orphaned launchd items', { error: err })
    }
  }
}

// ── macOS ──

async function getMacStartupItems(): Promise<StartupItem[]> {
  const items: StartupItem[] = []
  const home = homedir()
  const bundleAppNameCache = new Map<string, string | null>()

  // User Launch Agents
  const userAgentsDir = path.join(home, 'Library', 'LaunchAgents')
  await scanPlistDir(userAgentsDir, 'launch_agent', 'user', items, bundleAppNameCache)

  // System Launch Agents
  await scanPlistDir('/Library/LaunchAgents', 'launch_agent', 'system', items, bundleAppNameCache)

  // System Launch Daemons
  await scanPlistDir('/Library/LaunchDaemons', 'launch_daemon', 'system', items, bundleAppNameCache)

  return items
}

async function scanPlistDir(
  dirPath: string,
  type: 'launch_agent' | 'launch_daemon',
  scope: 'user' | 'system',
  items: StartupItem[],
  bundleAppNameCache: Map<string, string | null>
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
          name: await deriveFriendlyName(info, label, bundleAppNameCache),
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

/**
 * Best-effort display name matching what macOS System Settings shows for login items,
 * instead of the raw reverse-DNS launchd label. Order of preference: an .app bundle
 * mentioned in the program arguments, the AssociatedBundleIdentifiers app resolved via
 * Spotlight, then a humanized version of the label.
 */
async function deriveFriendlyName(info: PlistInfo, label: string, cache: Map<string, string | null>): Promise<string> {
  const paths = [info.program, ...(info.programArguments ?? [])].filter((p): p is string => typeof p === 'string')
  for (const p of paths) {
    const match = /\/([^/]+)\.app(?:\/|$)/.exec(p)
    if (match) return match[1]
  }

  for (const bundleId of info.associatedBundleIdentifiers ?? []) {
    const appName = await appNameForBundleId(bundleId, cache)
    if (appName) return appName
  }

  return humanizeLabel(label)
}

async function appNameForBundleId(bundleId: string, cache: Map<string, string | null>): Promise<string | null> {
  const cached = cache.get(bundleId)
  if (cached !== undefined) return cached
  let appName: string | null = null
  try {
    const { stdout } = await runExternalCommand('mdfind', [`kMDItemCFBundleIdentifier == "${bundleId}"`], { timeout: 10000 })
    const appPath = stdout.split('\n').find((l) => l.trim().endsWith('.app'))
    if (appPath) appName = path.basename(appPath.trim(), '.app')
  } catch {
    appName = null
  }
  cache.set(bundleId, appName)
  return appName
}

const LABEL_TLD_PREFIXES = new Set(['com', 'org', 'net', 'io', 'us', 'co', 'kr', 'jp', 'de', 'app'])

/** "us.zoom.updater" → "Zoom Updater", "OpenUsage" → "OpenUsage" */
function humanizeLabel(label: string): string {
  const parts = label.split('.')
  if (parts.length === 1) return label
  const rest = LABEL_TLD_PREFIXES.has(parts[0].toLowerCase()) ? parts.slice(1) : parts
  return rest
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

interface PlistInfo {
  label?: string
  disabled?: boolean
  program?: string
  programArguments?: string[]
  associatedBundleIdentifiers?: string[]
}

async function parsePlist(plistPath: string): Promise<PlistInfo> {
  // Use plutil to convert plist to JSON
  const { stdout } = await runExternalCommand('plutil', ['-convert', 'json', '-o', '-', plistPath], { timeout: 5000 })
  const data = JSON.parse(stdout) as Record<string, unknown>
  const abi = data.AssociatedBundleIdentifiers
  return {
    label: typeof data.Label === 'string' ? data.Label : undefined,
    disabled: data.Disabled === true,
    program: typeof data.Program === 'string' ? data.Program : undefined,
    programArguments: Array.isArray(data.ProgramArguments) ? data.ProgramArguments.filter((a): a is string => typeof a === 'string') : undefined,
    associatedBundleIdentifiers:
      typeof abi === 'string' ? [abi] : Array.isArray(abi) ? abi.filter((a): a is string => typeof a === 'string') : undefined,
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

    // Write back via plutil. execFile cannot pipe JSON to plutil's stdin, so we
    // convert from a temp file rather than reading from `-` (which would receive
    // no input and could truncate item.path).
    const jsonStr = JSON.stringify(data)

    if (item.scope === 'system') {
      // /Library is root-owned: build the new plist in a user-writable temp dir,
      // then install it (and bootstrap/bootout daemons) through one admin prompt.
      const tmpBase = path.join(tmpdir(), `systemscope-toggle-${Date.now().toString(36)}`)
      const tmpJson = `${tmpBase}.json`
      const tmpPlist = `${tmpBase}.plist`
      try {
        await fs.writeFile(tmpJson, jsonStr, 'utf-8')
        await runExternalCommand('plutil', ['-convert', 'xml1', tmpJson, '-o', tmpPlist], { timeout: 5000 })

        const lines = [
          // cp -f rewrites the destination in place, preserving root:wheel ownership.
          `cp -f ${shellQuote(tmpPlist)} ${shellQuote(item.path)}`,
        ]
        if (item.type === 'launch_daemon') {
          lines.push(
            enabled
              ? `launchctl bootstrap system ${shellQuote(item.path)} 2>/dev/null || true`
              : `launchctl bootout system ${shellQuote(item.path)} 2>/dev/null || true`
          )
        }
        await runAdminShellScript(lines.join('\n'))
      } finally {
        await fs.unlink(tmpJson).catch(() => {})
        await fs.unlink(tmpPlist).catch(() => {})
      }

      // System-located launch agents run in the user's gui domain, so the
      // user-level launchctl below handles them; daemons were handled above.
      if (item.type === 'launch_daemon') return
    } else {
      const tmpPath = item.path + '.tmp.json'
      try {
        await fs.writeFile(tmpPath, jsonStr, 'utf-8')
        await runExternalCommand('plutil', ['-convert', 'xml1', tmpPath, '-o', item.path], { timeout: 5000 })
      } finally {
        await fs.unlink(tmpPath).catch(() => {})
      }
    }

    // Load/unload the agent in the current user's session
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
