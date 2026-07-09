export type StartupItemType = 'launch_agent' | 'launch_daemon' | 'login_item' | 'registry_run' | 'startup_folder'
export type StartupItemScope = 'user' | 'system'

export interface StartupItem {
  id: string
  name: string
  path: string
  type: StartupItemType
  scope: StartupItemScope
  enabled: boolean
  label: string | null
  description: string | null
  /**
   * True for macOS items that exist only in the Background Task Management database
   * (System Settings > Login Items & Extensions) — login-item helpers, app-embedded
   * SMAppService agents, and "Open at Login" apps. macOS offers no public API to
   * toggle another app's BTM item, so these are listed but not toggleable here.
   */
  managedBySystemSettings?: boolean
}

export interface StartupToggleResult {
  id: string
  enabled: boolean
  success: boolean
  error: string | null
}

export type OrphanedLaunchAgentKind = 'launch_agent' | 'launch_daemon'
export type OrphanedLaunchAgentReason = 'missing_executable' | 'broken_symlink' | 'missing_app'

/**
 * A LaunchAgent/LaunchDaemon plist whose target no longer exists on disk (leftover from an
 * uninstalled app) — the executable it points at is missing, the plist itself is a broken
 * symlink, or its AssociatedBundleIdentifiers app is no longer installed (lower confidence).
 * System-scope entries live in /Library and need admin rights to remove.
 */
export interface OrphanedLaunchAgent {
  id: string
  label: string
  plistPath: string
  missingExecutable: string
  scope: StartupItemScope
  kind: OrphanedLaunchAgentKind
  reason: OrphanedLaunchAgentReason
}

export interface RemoveOrphanedResult {
  removedCount: number
  failedCount: number
  removedPaths: string[]
  errors: string[]
}
