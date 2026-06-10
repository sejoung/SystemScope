import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import type { StartupItem } from '@shared/types'
import { runExternalCommand } from '@main/services/core/externalCommand'
import { logDebug } from '@main/services/core/logging'
import { runWithConcurrency } from '@main/services/core/runWithConcurrency'
import { shellQuote, runAdminShellScript } from '@main/services/core/adminShell.mac'
import { mdfindBundlePaths } from '@main/services/core/spotlight.mac'
import { startupItemId } from './startupItemId'
import {
  LAUNCHD_SCAN_LOCATIONS,
  LAUNCHCTL_TIMEOUT_MS,
  PLIST_SCAN_CONCURRENCY,
  PLUTIL_TIMEOUT_MS,
  parsePlist,
  type LaunchdScanLocation,
  type PlistInfo,
} from './launchd.mac'

export async function getMacStartupItems(): Promise<StartupItem[]> {
  const items: StartupItem[] = []
  await Promise.all(LAUNCHD_SCAN_LOCATIONS.map((location) => scanPlistDir(location, items)))
  return items
}

/**
 * Locate one launchd item by its id without parsing every plist: ids are derived from
 * the plist path, so hashing each directory entry is enough (no plutil/mdfind spawns).
 */
export async function findMacStartupItemById(id: string): Promise<StartupItem | null> {
  for (const location of LAUNCHD_SCAN_LOCATIONS) {
    let entries: string[]
    try {
      entries = await fs.readdir(location.dir)
    } catch {
      continue
    }
    for (const fileName of entries) {
      if (!fileName.endsWith('.plist')) continue
      const fullPath = path.join(location.dir, fileName)
      if (startupItemId(fullPath) !== id) continue
      const label = path.basename(fileName, '.plist')
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
  await runWithConcurrency(plists, PLIST_SCAN_CONCURRENCY, async (fileName) => {
    const fullPath = path.join(location.dir, fileName)
    try {
      const info = await parsePlist(fullPath)
      const label = info.label || path.basename(fileName, '.plist')
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

// ── Toggle ──

export async function toggleMacItem(item: StartupItem, enabled: boolean): Promise<void> {
  if (item.type !== 'launch_agent' && item.type !== 'launch_daemon') return

  // Symlinked plists point into their app's bundle (e.g. /Applications/Vendor.app/...).
  // Writing through the link would modify the bundle and break its code signature —
  // worse as root — so refuse instead of following it.
  const stats = await fs.lstat(item.path).catch(() => null)
  if (stats?.isSymbolicLink()) {
    throw new Error('This item is a link into its app bundle; change it from the app itself')
  }

  // Read current plist, set Disabled key, write back
  const { stdout } = await runExternalCommand('plutil', ['-convert', 'json', '-o', '-', item.path], { timeout: PLUTIL_TIMEOUT_MS })
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
      await runExternalCommand('plutil', ['-convert', 'xml1', tmpPath, '-o', item.path], { timeout: PLUTIL_TIMEOUT_MS })
    } finally {
      await fs.unlink(tmpPath).catch(() => {})
    }
  }

  // Daemons were bootstrapped/booted out inside the admin script; agents (user- or
  // system-located) run in the user's gui session, so plain launchctl handles them.
  if (item.type === 'launch_agent') {
    try {
      await runExternalCommand('launchctl', [enabled ? 'load' : 'unload', item.path], { timeout: LAUNCHCTL_TIMEOUT_MS })
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
    await runExternalCommand('plutil', ['-convert', 'xml1', tmpJson, '-o', tmpPlist], { timeout: PLUTIL_TIMEOUT_MS })

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
