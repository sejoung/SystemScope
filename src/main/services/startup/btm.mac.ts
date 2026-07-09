import * as path from 'node:path'
import { userInfo } from 'node:os'
import type { StartupItem } from '@shared/types'
import { runExternalCommand } from '@main/services/core/externalCommand'
import { logInfo } from '@main/services/core/logging'
import { getMacStartupItems } from './startupItems.mac'

// ── Background Task Management (macOS System Settings > Login Items & Extensions) ──
//
// The plist scan in startupItems.mac.ts only sees ~/Library/LaunchAgents and
// /Library/Launch{Agents,Daemons}. System Settings builds its list from the BTM
// database instead, which additionally holds login-item helpers
// (Foo.app/Contents/Library/LoginItems), SMAppService agents embedded in app bundles
// (Foo.app/Contents/Library/LaunchAgents), and "Open at Login" apps — plus the
// authoritative on/off state for everything. `sfltool dumpbtm` reads that database.

/** Reading the BTM database triggers a macOS admin-authorization dialog — leave time to type the password. */
const SFLTOOL_TIMEOUT_MS = 120_000
const SFLTOOL_MAX_BUFFER = 10 * 1024 * 1024

export interface BtmRecord {
  uuid: string
  name: string
  /** Lowercased type text without the hex code, e.g. "app", "login item", "legacy agent". */
  type: string
  /**
   * Effective on/off state. The System Settings toggle records OFF as "disallowed"
   * while leaving the "enabled" bit set (verified against `launchctl list`: only
   * [enabled, allowed] items are actually loaded), so both must hold.
   */
  enabled: boolean
  identifier: string | null
  developerName: string | null
  /** Absolute filesystem path of the item; relative bundle URLs are resolved against the owning app record. */
  absolutePath: string | null
  sectionUid: number
}

/**
 * Full startup list matching what System Settings shows: the plist scan, with its
 * enabled state corrected by BTM, plus BTM-only items appended (marked
 * managedBySystemSettings since they cannot be toggled from here).
 */
export async function getMacStartupItemsWithBtm(): Promise<StartupItem[]> {
  const { stdout } = await runExternalCommand('sfltool', ['dumpbtm'], {
    timeout: SFLTOOL_TIMEOUT_MS,
    maxBuffer: SFLTOOL_MAX_BUFFER,
  })
  const records = parseBtmDump(stdout)
  const items = await getMacStartupItems()
  const merged = mergeBtmRecords(items, records, userInfo().uid)
  logInfo('startup-manager', 'BTM scan completed', {
    btmRecords: records.length,
    btmOnlyItems: merged.filter((i) => i.managedBySystemSettings).length,
  })
  return merged
}

interface MutableRecord {
  uuid?: string
  name?: string
  type?: string
  enabled?: boolean
  identifier?: string
  developerName?: string
  rawUrl?: string
  sectionUid: number
}

/**
 * Parse `sfltool dumpbtm` output. Records look like:
 *
 *   ========================
 *    Records for UID 501 : <uuid>
 *   ========================
 *    Items:
 *    #1:
 *                    UUID: 9EBD8993-...
 *                    Name: DockerHelper
 *                    Type: login item (0x4)
 *             Disposition: [enabled, allowed, notified] (0xb)
 *              Identifier: com.docker.helper
 *                     URL: Contents/Library/LoginItems/DockerHelper.app
 *
 * Embedded items carry bundle-relative URLs; they follow their owning `app` record,
 * so the last seen app path in a section resolves them.
 */
export function parseBtmDump(raw: string): BtmRecord[] {
  const records: BtmRecord[] = []
  let sectionUid = Number.NaN
  let lastAppPath: string | null = null
  let current: MutableRecord | null = null

  const flush = (): void => {
    if (!current?.uuid || !current.type) {
      current = null
      return
    }
    const absolutePath = resolveRecordPath(current.rawUrl, lastAppPath)
    records.push({
      uuid: current.uuid,
      name: current.name ?? current.identifier ?? current.uuid,
      type: current.type,
      enabled: current.enabled === true,
      identifier: current.identifier ?? null,
      developerName: current.developerName ?? null,
      absolutePath,
      sectionUid: current.sectionUid,
    })
    if (current.type === 'app' && absolutePath) lastAppPath = absolutePath
    current = null
  }

  for (const line of raw.split('\n')) {
    const section = /^\s*Records for UID (-?\d+)/.exec(line)
    if (section) {
      flush()
      sectionUid = Number(section[1])
      lastAppPath = null
      continue
    }
    if (/^\s*#\d+:\s*$/.test(line)) {
      flush()
      current = { sectionUid }
      continue
    }
    if (!current) continue

    const field = /^\s+([A-Za-z][A-Za-z ]*?):\s(.*)$/.exec(line)
    if (!field) continue
    const value = field[2].trim()
    switch (field[1]) {
      case 'UUID':
        current.uuid = value
        break
      case 'Name':
        current.name = value
        break
      case 'Developer Name':
        current.developerName = value
        break
      case 'Identifier':
        current.identifier = value
        break
      case 'Type':
        current.type = value.replace(/\s*\(0x[0-9a-f]+\)\s*$/i, '').trim().toLowerCase()
        break
      case 'Disposition':
        current.enabled = /^\[\s*enabled,\s*allowed\b/.test(value)
        break
      case 'URL':
        current.rawUrl = value
        break
    }
  }
  flush()
  return records
}

function resolveRecordPath(rawUrl: string | undefined, lastAppPath: string | null): string | null {
  if (!rawUrl || rawUrl === '(null)') return null
  try {
    if (rawUrl.startsWith('file://')) {
      return decodeURIComponent(new URL(rawUrl).pathname).replace(/\/+$/, '')
    }
    // Bundle-relative URL (e.g. "Contents/Library/LoginItems/DockerHelper.app")
    if (!lastAppPath) return null
    return path.join(lastAppPath, decodeURIComponent(rawUrl))
  } catch {
    return null
  }
}

/** BTM item types System Settings shows as startup entries that the plist scan can never find. */
const BTM_ONLY_TYPES: Record<string, StartupItem['type']> = {
  'login item': 'login_item',
  agent: 'launch_agent',
  daemon: 'launch_daemon',
}

export function mergeBtmRecords(items: StartupItem[], records: BtmRecord[], currentUid: number): StartupItem[] {
  // Negative-UID sections hold system-wide (daemon) records; other users' sections are irrelevant.
  const relevant = records.filter((r) => r.sectionUid === currentUid || r.sectionUid < 0)

  // 1) System Settings' toggle state lives in BTM, not in the plist's Disabled key —
  //    a legacy record marked disabled there overrides what the plist says.
  const btmDisabledPaths = new Set(
    relevant
      .filter((r) => (r.type === 'legacy agent' || r.type === 'legacy daemon') && !r.enabled && r.absolutePath)
      .map((r) => r.absolutePath as string)
  )
  const merged = items.map((item) =>
    btmDisabledPaths.has(item.path) && item.enabled ? { ...item, enabled: false } : item
  )

  // 2) Append items that only exist in BTM. The same physical item can appear in
  //    several UID sections under different UUIDs, so dedupe by path/identifier.
  const knownPaths = new Set(items.map((i) => i.path))
  const seen = new Set<string>()
  for (const r of relevant) {
    let type = BTM_ONLY_TYPES[r.type]
    // "Open at Login" apps: every registered app has a record; only enabled ones
    // actually launch at login (and are what System Settings lists as open-at-login).
    if (r.type === 'app') {
      if (!r.enabled) continue
      type = 'login_item'
    }
    if (!type) continue
    if (r.absolutePath && knownPaths.has(r.absolutePath)) continue
    const dedupeKey = r.absolutePath ?? `${r.type}:${r.identifier ?? r.name}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    merged.push({
      id: `btm:${r.uuid}`,
      name: r.name,
      path: r.absolutePath ?? (r.identifier ?? r.name),
      type,
      scope: type === 'launch_daemon' ? 'system' : 'user',
      enabled: r.enabled,
      label: r.identifier,
      description: r.absolutePath ?? r.developerName,
      managedBySystemSettings: true,
    })
  }
  return merged
}
