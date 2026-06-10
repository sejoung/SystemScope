import * as path from 'node:path'
import { homedir } from 'node:os'
import { runExternalCommand } from '@main/services/core/externalCommand'

export const PLUTIL_TIMEOUT_MS = 5000
export const LAUNCHCTL_TIMEOUT_MS = 5000
export const PLIST_SCAN_CONCURRENCY = 8

export const USER_LAUNCH_AGENTS_DIR = path.join(homedir(), 'Library', 'LaunchAgents')
const SYSTEM_LAUNCH_AGENTS_DIR = '/Library/LaunchAgents'
const SYSTEM_LAUNCH_DAEMONS_DIR = '/Library/LaunchDaemons'

export interface LaunchdScanLocation {
  dir: string
  kind: 'launch_agent' | 'launch_daemon'
  scope: 'user' | 'system'
}

/** The launchd directories this app manages — single source of truth for listing, orphan scanning, and removal containment. */
export const LAUNCHD_SCAN_LOCATIONS: LaunchdScanLocation[] = [
  { dir: USER_LAUNCH_AGENTS_DIR, kind: 'launch_agent', scope: 'user' },
  { dir: SYSTEM_LAUNCH_AGENTS_DIR, kind: 'launch_agent', scope: 'system' },
  { dir: SYSTEM_LAUNCH_DAEMONS_DIR, kind: 'launch_daemon', scope: 'system' },
]

export interface PlistInfo {
  label?: string
  disabled?: boolean
  program?: string
  programArguments?: string[]
  associatedBundleIdentifiers?: string[]
}

export async function parsePlist(plistPath: string): Promise<PlistInfo> {
  // Use plutil to convert plist to JSON
  const { stdout } = await runExternalCommand('plutil', ['-convert', 'json', '-o', '-', plistPath], { timeout: PLUTIL_TIMEOUT_MS })
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

/** Resolve the absolute executable (or .app bundle) a launchd plist points at, or null when it can't be determined safely. */
export function resolveLaunchAgentExecutable(info: PlistInfo): string | null {
  const args = info.programArguments ?? []
  let candidate = info.program ?? args[0]
  if (!candidate) return null

  // `open <path>` launchers (e.g. Epic Games) don't reference a binary directly —
  // the real target is the first path argument, typically an .app bundle.
  if (candidate === 'open' || candidate === '/usr/bin/open') {
    const target = args.slice(1).find((a) => a.startsWith('/'))
    if (!target) return null
    candidate = target
  }

  if (candidate.startsWith('~')) {
    candidate = path.join(homedir(), candidate.slice(1))
  }
  // Only absolute paths are confidently checkable; bare commands resolve via PATH.
  if (!candidate.startsWith('/')) return null
  return candidate
}
