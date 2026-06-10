import { shell } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir, platform, tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import type { StartupItem, StartupToggleResult, OrphanedLaunchAgent, RemoveOrphanedResult } from '@shared/types'
import { runExternalCommand, isExternalCommandError } from '@main/services/core/externalCommand'
import { logInfo, logWarn, logError, logDebug } from '@main/services/core/logging'
import { runWithConcurrency } from './installedAppsShared'

/** Stable id for a startup item, derived from its unique path. Removal matches scan results by this. */
function startupItemId(uniquePath: string): string {
  return createHash('sha256').update(uniquePath).digest('hex').slice(0, 16)
}

export async function getStartupItems(): Promise<StartupItem[]> {
  const p = platform()
  if (p === 'darwin') return getMacStartupItems()
  if (p === 'win32') return getWindowsStartupItems()
  return []
}

export async function toggleStartupItem(id: string, enabled: boolean): Promise<StartupToggleResult> {
  // On macOS the id is derived from the plist path, so the item can be located
  // directly without re-parsing every plist (and re-running Spotlight lookups).
  const item = platform() === 'darwin' ? await findMacStartupItemById(id) : (await getStartupItems()).find((i) => i.id === id)
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

interface LaunchdScanLocation {
  dir: string
  kind: 'launch_agent' | 'launch_daemon'
  scope: 'user' | 'system'
}

/** The launchd directories this module manages — single source of truth for listing, orphan scanning, and removal containment. */
const LAUNCHD_SCAN_LOCATIONS: LaunchdScanLocation[] = [
  { dir: USER_LAUNCH_AGENTS_DIR, kind: 'launch_agent', scope: 'user' },
  { dir: SYSTEM_LAUNCH_AGENTS_DIR, kind: 'launch_agent', scope: 'system' },
  { dir: SYSTEM_LAUNCH_DAEMONS_DIR, kind: 'launch_daemon', scope: 'system' },
]

const PLIST_SCAN_CONCURRENCY = 8

export async function findOrphanedLaunchAgents(): Promise<OrphanedLaunchAgent[]> {
  if (platform() !== 'darwin') return []

  const orphans: OrphanedLaunchAgent[] = []
  await Promise.all(LAUNCHD_SCAN_LOCATIONS.map((location) => scanLocationForOrphans(location, orphans)))

  logInfo('startup-manager', 'Orphaned LaunchAgent scan completed', { count: orphans.length })
  return orphans
}

// ── Spotlight (mdfind) lookups ──
//
// All bundle-id → app-path resolution goes through one cached helper. The cache is
// module-level with a TTL so repeated scans (tab visits, the pre-removal re-scan,
// friendly-name derivation) don't re-pay Spotlight queries for the same ids.

const MDFIND_CACHE_TTL_MS = 5 * 60 * 1000
const mdfindCache = new Map<string, { paths: string[] | null; at: number }>()

/**
 * Resolve the indexed paths for a bundle id (or vendor glob like "com.adobe.*") via
 * Spotlight. Returns null when the answer cannot be trusted: the query contains
 * characters that would break the mdfind expression, mdfind itself fails, or
 * Spotlight indexing is unavailable (probed once per TTL window via com.apple.finder,
 * which is always installed — an empty result for it means the index is off/rebuilding,
 * in which case empty results must not be read as "app not installed").
 */
async function mdfindBundlePaths(bundleQuery: string, onlyIn?: string[]): Promise<string[] | null> {
  // Quotes/backslashes would break out of the query string; reject rather than escape.
  // ('*' is allowed — vendor globs rely on it.)
  if (/["\\]/.test(bundleQuery)) return null

  const key = `${onlyIn?.join('|') ?? ''}::${bundleQuery}`
  const cached = mdfindCache.get(key)
  if (cached && Date.now() - cached.at < MDFIND_CACHE_TTL_MS) return cached.paths

  let paths: string[] | null
  try {
    const onlyInArgs = (onlyIn ?? []).flatMap((dir) => ['-onlyin', dir])
    const { stdout } = await runExternalCommand(
      'mdfind',
      [...onlyInArgs, `kMDItemCFBundleIdentifier == "${bundleQuery}"`],
      { timeout: 10000 }
    )
    paths = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
    if (paths.length === 0 && !(await spotlightIndexAvailable())) paths = null
  } catch {
    paths = null
  }

  mdfindCache.set(key, { paths, at: Date.now() })
  return paths
}

async function spotlightIndexAvailable(): Promise<boolean> {
  const key = '::__spotlight_probe__'
  const cached = mdfindCache.get(key)
  if (cached && Date.now() - cached.at < MDFIND_CACHE_TTL_MS) return cached.paths !== null

  let available: boolean
  try {
    const { stdout } = await runExternalCommand('mdfind', ['kMDItemCFBundleIdentifier == "com.apple.finder"'], { timeout: 10000 })
    available = stdout.trim().length > 0
  } catch {
    available = false
  }
  mdfindCache.set(key, { paths: available ? ['probe-ok'] : null, at: Date.now() })
  return available
}

/**
 * Whether an app with this bundle id is installed, resolved via Spotlight.
 * Errs on the side of "installed" (never flag) when the lookup can't be trusted.
 */
async function isBundleIdInstalled(bundleId: string): Promise<boolean> {
  const paths = await mdfindBundlePaths(bundleId)
  if (paths === null) return true
  return paths.length > 0
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
async function vendorAppInstalled(vendorGlob: string): Promise<boolean> {
  const paths = await mdfindBundlePaths(vendorGlob, ['/Applications', path.join(homedir(), 'Applications')])
  if (paths === null) return true // err on the side of "installed" → never flag
  return paths.length > 0
}

async function scanLocationForOrphans(location: LaunchdScanLocation, orphans: OrphanedLaunchAgent[]): Promise<void> {
  let entries: string[]
  try {
    entries = await fs.readdir(location.dir)
  } catch {
    return
  }

  const plists = entries.filter((e) => e.endsWith('.plist') && !e.startsWith('com.apple.')) // Apple-managed entries are off-limits
  await runWithConcurrency(plists, PLIST_SCAN_CONCURRENCY, async (entry) => {
    const plistPath = path.join(location.dir, entry)
    try {
      const orphan = await classifyOrphan(plistPath, entry, location)
      if (orphan) orphans.push(orphan)
    } catch {
      logDebug('startup-manager', 'Skipping unparseable plist during orphan scan', { path: plistPath })
    }
  })
}

/** Decide whether one plist is an orphan; returns null for healthy (or unverifiable) items. */
async function classifyOrphan(plistPath: string, entry: string, location: LaunchdScanLocation): Promise<OrphanedLaunchAgent | null> {
  const makeOrphan = (label: string, missingExecutable: string, reason: OrphanedLaunchAgent['reason']): OrphanedLaunchAgent => ({
    id: startupItemId(plistPath),
    label,
    plistPath,
    missingExecutable,
    scope: location.scope,
    kind: location.kind,
    reason,
  })

  const stats = await fs.lstat(plistPath)
  if (stats.isSymbolicLink()) {
    try {
      await fs.access(plistPath) // follows the link
    } catch {
      // Broken symlink — the app bundle the link pointed into is gone.
      const target = await fs.readlink(plistPath).catch(() => '')
      return makeOrphan(entry.replace('.plist', ''), target || plistPath, 'broken_symlink')
    }
  }

  const info = await parsePlist(plistPath)
  const label = info.label || entry.replace('.plist', '')
  // Apple-managed agents are off-limits.
  if (label.startsWith('com.apple.')) return null

  const executable = resolveLaunchAgentExecutable(info)
  if (!executable) return null // can't determine the binary → never flag

  let executableExists = true
  try {
    await fs.access(executable)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    // Only a confirmed absence counts; EACCES/EPERM etc. mean "can't verify" → never flag.
    if (code !== 'ENOENT' && code !== 'ENOTDIR') return null
    executableExists = false
  }

  if (!executableExists) return makeOrphan(label, executable, 'missing_executable')

  // Executable exists — lower-confidence checks for "the owning app is gone".
  const bundleIds = info.associatedBundleIdentifiers?.filter((b) => !b.startsWith('com.apple.')) ?? []
  if (bundleIds.length > 0) {
    // The plist declares which app it belongs to (AssociatedBundleIdentifiers)
    // (e.g. Wireshark's ChmodBPF daemon outliving Wireshark.app).
    const checks = await Promise.all(bundleIds.map((b) => isBundleIdInstalled(b)))
    if (checks.some(Boolean)) return null // any owning app still installed → not orphaned
    return makeOrphan(label, bundleIds.join(', '), 'missing_app')
  }

  if (isAppHelperExecutable(executable)) {
    // No declared app, but the executable is a helper that only an app would have
    // installed (e.g. Adobe's ARMDC updater outliving Acrobat). Flag it when the
    // vendor no longer has any app in the app folders.
    const vendorGlob = vendorGlobForLabel(label)
    if (!vendorGlob) return null
    if (await vendorAppInstalled(vendorGlob)) return null
    return makeOrphan(label, vendorGlob, 'missing_app')
  }

  return null
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

const ALLOWED_ORPHAN_DIRS = new Set(LAUNCHD_SCAN_LOCATIONS.map((l) => l.dir))

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
 * user's Trash and chowned back so they can be inspected or restored. The shell ignores
 * per-line failures (no `set -e`, trailing `|| true`s), so success is determined per item
 * afterwards by checking whether the plist actually left its directory.
 */
async function removeSystemOrphansWithAdmin(orphans: OrphanedLaunchAgent[], result: RemoveOrphanedResult): Promise<void> {
  const trashDir = path.join(homedir(), '.Trash')
  const uid = process.getuid?.() ?? 0
  const gid = process.getgid?.() ?? 0

  const lines: string[] = []
  for (const orphan of orphans) {
    const base = path.basename(orphan.plistPath, '.plist')
    // orphan.id is unique per path, so same-named plists from different dirs can't collide in the Trash.
    const trashPath = path.join(trashDir, `${base}.${orphan.id}.plist`)
    // Best-effort: stop launchd from referencing the item before removal.
    if (orphan.kind === 'launch_daemon') {
      lines.push(`launchctl bootout system ${shellQuote(orphan.plistPath)} 2>/dev/null || true`)
    } else {
      lines.push(`launchctl bootout gui/${uid} ${shellQuote(orphan.plistPath)} 2>/dev/null || true`)
    }
    lines.push(`mv -f ${shellQuote(orphan.plistPath)} ${shellQuote(trashPath)}`)
    lines.push(`chown -h ${uid}:${gid} ${shellQuote(trashPath)} 2>/dev/null || true`)
  }

  let scriptError: string | null = null
  try {
    await runAdminShellScript(lines.join('\n'))
  } catch (err) {
    scriptError = err instanceof Error ? err.message : String(err)
  }

  // Per-item verification: a plist that is still present was not removed, whatever the shell said.
  for (const orphan of orphans) {
    const stillPresent = await fs.lstat(orphan.plistPath).then(() => true).catch(() => false)
    if (!stillPresent) {
      result.removedCount++
      result.removedPaths.push(orphan.plistPath)
    } else {
      result.failedCount++
      result.errors.push(`${orphan.label}: ${scriptError ?? 'failed to move to Trash'}`)
    }
  }

  if (scriptError) {
    const canceled = scriptError.includes('canceled')
    if (canceled) {
      logInfo('startup-manager', 'System orphan removal canceled by user at admin prompt', { count: orphans.length })
    } else {
      logError('startup-manager', 'Failed to remove system-scope orphaned launchd items', { error: scriptError })
    }
  } else {
    logInfo('startup-manager', 'Removed system-scope orphaned launchd items', {
      removed: result.removedPaths.length,
      stillPresent: orphans.length - result.removedPaths.length,
    })
  }
}

// ── macOS ──

async function getMacStartupItems(): Promise<StartupItem[]> {
  const items: StartupItem[] = []
  await Promise.all(LAUNCHD_SCAN_LOCATIONS.map((location) => scanPlistDir(location, items)))
  return items
}

/**
 * Locate one launchd item by its id without parsing every plist: ids are derived from
 * the plist path, so hashing each directory entry is enough (no plutil/mdfind spawns).
 */
async function findMacStartupItemById(id: string): Promise<StartupItem | null> {
  for (const location of LAUNCHD_SCAN_LOCATIONS) {
    let entries: string[]
    try {
      entries = await fs.readdir(location.dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.endsWith('.plist')) continue
      const fullPath = path.join(location.dir, entry)
      if (startupItemId(fullPath) !== id) continue
      const label = entry.replace('.plist', '')
      return {
        id,
        name: label,
        path: fullPath,
        type: location.kind,
        scope: location.scope,
        enabled: true, // not needed by the toggle path
        label,
        description: null,
      }
    }
  }
  return null
}

async function scanPlistDir(location: LaunchdScanLocation, items: StartupItem[]): Promise<void> {
  let entries: string[]
  try {
    entries = await fs.readdir(location.dir)
  } catch {
    return // Directory not accessible or doesn't exist
  }

  const plists = entries.filter((e) => e.endsWith('.plist'))
  await runWithConcurrency(plists, PLIST_SCAN_CONCURRENCY, async (entry) => {
    const fullPath = path.join(location.dir, entry)
    try {
      const info = await parsePlist(fullPath)
      const label = info.label || entry.replace('.plist', '')
      const disabled = info.disabled === true

      items.push({
        id: startupItemId(fullPath),
        name: await deriveFriendlyName(info, label),
        path: fullPath,
        type: location.kind,
        scope: location.scope,
        enabled: !disabled,
        label,
        description: info.program || info.programArguments?.[0] || null,
      })
    } catch {
      logDebug('startup-manager', 'Skipping unparseable plist', { path: fullPath })
    }
  })
}

/**
 * Best-effort display name matching what macOS System Settings shows for login items,
 * instead of the raw reverse-DNS launchd label. Order of preference: an .app bundle
 * mentioned in the program arguments, the AssociatedBundleIdentifiers app resolved via
 * Spotlight, then a humanized version of the label.
 */
async function deriveFriendlyName(info: PlistInfo, label: string): Promise<string> {
  const paths = [info.program, ...(info.programArguments ?? [])].filter((p): p is string => typeof p === 'string')
  for (const p of paths) {
    const match = /\/([^/]+)\.app(?:\/|$)/.exec(p)
    if (match) return match[1]
  }

  for (const bundleId of info.associatedBundleIdentifiers ?? []) {
    const appPath = (await mdfindBundlePaths(bundleId))?.find((l) => l.endsWith('.app'))
    if (appPath) return path.basename(appPath, '.app')
  }

  return humanizeLabel(label)
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
  if (item.type !== 'launch_agent' && item.type !== 'launch_daemon') return

  // Symlinked plists point into their app's bundle (e.g. /Applications/Vendor.app/...).
  // Writing through the link would modify the bundle and break its code signature —
  // worse as root — so refuse instead of following it.
  const stats = await fs.lstat(item.path).catch(() => null)
  if (stats?.isSymbolicLink()) {
    throw new Error('This item is a link into its app bundle; change it from the app itself')
  }

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
    await writeSystemPlistWithAdmin(item, jsonStr, enabled)
  } else {
    const tmpPath = item.path + '.tmp.json'
    try {
      await fs.writeFile(tmpPath, jsonStr, 'utf-8')
      await runExternalCommand('plutil', ['-convert', 'xml1', tmpPath, '-o', item.path], { timeout: 5000 })
    } finally {
      await fs.unlink(tmpPath).catch(() => {})
    }
  }

  // Daemons were bootstrapped/booted out inside the admin script; agents (user- or
  // system-located) run in the user's gui session, so plain launchctl handles them.
  if (item.type === 'launch_agent') {
    try {
      await runExternalCommand('launchctl', [enabled ? 'load' : 'unload', item.path], { timeout: 5000 })
    } catch {
      // launchctl may fail if already loaded/unloaded — acceptable
    }
  }
}

/**
 * /Library is root-owned: build the new plist in a user-writable temp dir, then
 * install it (and bootstrap/bootout daemons) through one admin prompt.
 */
async function writeSystemPlistWithAdmin(item: StartupItem, jsonStr: string, enabled: boolean): Promise<void> {
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
        id: startupItemId(`${regPath}\\${name}`),
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
        id: startupItemId(fullPath),
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
