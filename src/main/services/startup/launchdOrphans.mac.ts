import { shell } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir, platform } from 'node:os'
import type { OrphanedLaunchAgent, RemoveOrphanedResult } from '@shared/types'
import { runExternalCommand } from '@main/services/core/externalCommand'
import { logInfo, logWarn, logError, logDebug } from '@main/services/core/logging'
import { runWithConcurrency } from '@main/services/core/runWithConcurrency'
import { shellQuote, runAdminShellScript } from '@main/services/core/adminShell.mac'
import { mdfindBundlePaths } from '@main/services/core/spotlight.mac'
import { startupItemId } from './startupItemId'
import {
  LAUNCHD_SCAN_LOCATIONS,
  LAUNCHCTL_TIMEOUT_MS,
  PLIST_SCAN_CONCURRENCY,
  parsePlist,
  resolveLaunchAgentExecutable,
  type LaunchdScanLocation,
} from './launchd.mac'

// ── Orphaned LaunchAgents / LaunchDaemons (macOS) ──
//
// A leftover launchd plist is one whose target no longer exists — typically left behind
// after an app is deleted, so it fails silently at every login/boot. Detection rules,
// ordered by confidence (see classifyOrphan):
//   1. broken_symlink      — the plist itself is a dead link into a removed app bundle
//   2. missing_executable  — the Program / ProgramArguments[0] binary is gone
//   3. missing_app         — the binary exists but the app that owns it is uninstalled
// User-scope entries are trashed directly; system-scope entries (/Library) are removed
// through a single osascript "with administrator privileges" prompt.

export async function findOrphanedLaunchAgents(): Promise<OrphanedLaunchAgent[]> {
  if (platform() !== 'darwin') return []

  const orphans: OrphanedLaunchAgent[] = []
  await Promise.all(LAUNCHD_SCAN_LOCATIONS.map((location) => scanLocationForOrphans(location, orphans)))

  logInfo('startup-manager', 'Orphaned LaunchAgent scan completed', { count: orphans.length })
  return orphans
}

async function scanLocationForOrphans(location: LaunchdScanLocation, orphans: OrphanedLaunchAgent[]): Promise<void> {
  let entries: string[]
  try {
    entries = await fs.readdir(location.dir)
  } catch {
    return
  }

  // The filename filter is a pre-screen that skips parsing for obvious Apple plists;
  // the authoritative com.apple. check runs on the parsed Label in classifyOrphan.
  const plists = entries.filter((e) => e.endsWith('.plist') && !e.startsWith('com.apple.'))
  await runWithConcurrency(plists, PLIST_SCAN_CONCURRENCY, async (fileName) => {
    const plistPath = path.join(location.dir, fileName)
    try {
      const orphan = await classifyOrphan(plistPath, fileName, location)
      if (orphan) orphans.push(orphan)
    } catch {
      logDebug('startup-manager', 'Skipping unparseable plist during orphan scan', { path: plistPath })
    }
  })
}

/** Decide whether one plist is an orphan; returns null for healthy (or unverifiable) items. */
async function classifyOrphan(plistPath: string, fileName: string, location: LaunchdScanLocation): Promise<OrphanedLaunchAgent | null> {
  const fallbackLabel = path.basename(fileName, '.plist')
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
      return makeOrphan(fallbackLabel, target || plistPath, 'broken_symlink')
    }
  }

  const info = await parsePlist(plistPath)
  const label = info.label || fallbackLabel
  // Apple-managed agents are off-limits (authoritative check — the filename pre-screen
  // in scanLocationForOrphans can't see labels that differ from the filename).
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

// ── Removal ──

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
    } else {
      await removeUserOrphan({ ...orphan, plistPath: resolved }, result)
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

/** User-scope orphans live in the user's own LaunchAgents dir: unload, then move to Trash. */
async function removeUserOrphan(orphan: OrphanedLaunchAgent, result: RemoveOrphanedResult): Promise<void> {
  try {
    // Best-effort unload so launchd stops referencing it; ignore failures.
    await runExternalCommand('launchctl', ['unload', orphan.plistPath], { timeout: LAUNCHCTL_TIMEOUT_MS }).catch(() => {})
    try {
      await shell.trashItem(orphan.plistPath)
    } catch (trashErr) {
      // Finder can refuse to trash a broken symlink; removing the dead link is equivalent.
      if (orphan.reason !== 'broken_symlink') throw trashErr
      await fs.unlink(orphan.plistPath)
    }
    result.removedCount++
    result.removedPaths.push(orphan.plistPath)
  } catch (err) {
    result.failedCount++
    const message = err instanceof Error ? err.message : String(err)
    result.errors.push(`${orphan.label}: ${message}`)
    logError('startup-manager', 'Failed to remove orphaned LaunchAgent', { path: orphan.plistPath, error: err })
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
