export const USER_DIR = '/Users/test/Library/LaunchAgents'
export const SYS_AGENTS_DIR = '/Library/LaunchAgents'
export const SYS_DAEMONS_DIR = '/Library/LaunchDaemons'

export const PLISTS: Record<string, Record<string, unknown>> = {
  [`${USER_DIR}/com.gone.app.plist`]: { Label: 'com.gone.app', ProgramArguments: ['/Applications/Gone.app/Contents/MacOS/Gone'] },
  [`${USER_DIR}/com.live.app.plist`]: { Label: 'com.live.app', Program: '/usr/local/bin/live' },
  [`${USER_DIR}/com.apple.thing.plist`]: { Label: 'com.apple.thing', ProgramArguments: ['/Applications/Gone2.app/x'] },
  [`${USER_DIR}/com.bare.cmd.plist`]: { Label: 'com.bare.cmd', ProgramArguments: ['osascript', '-e', 'x'] },
  [`${USER_DIR}/com.nopgm.plist`]: { Label: 'com.nopgm', KeepAlive: true },
  [`${USER_DIR}/com.epic.launcher.plist`]: { Label: 'com.epic.launcher', ProgramArguments: ['open', '/Applications/Epic Games Launcher.app', '--args', '-silent'] },
  // `open <app>` launcher whose app was uninstalled — the open target, not `open` itself, decides orphanhood.
  [`${USER_DIR}/com.gonegame.launcher.plist`]: { Label: 'com.gonegame.launcher', ProgramArguments: ['open', '/Applications/Gone Game.app', '--args', '-silent'] },
  [`${SYS_DAEMONS_DIR}/com.gonecorp.daemon.plist`]: { Label: 'com.gonecorp.daemon', ProgramArguments: ['/Library/PrivilegedHelperTools/gonecorp'] },
  [`${SYS_DAEMONS_DIR}/com.alive.daemon.plist`]: { Label: 'com.alive.daemon', Program: '/usr/local/bin/live', AssociatedBundleIdentifiers: ['com.alive.App'] },
  // Executable still exists, but the app that owns it (per AssociatedBundleIdentifiers) was uninstalled.
  [`${SYS_DAEMONS_DIR}/org.tool.helper.plist`]: { Label: 'org.tool.helper', ProgramArguments: ['/usr/local/bin/live'], AssociatedBundleIdentifiers: 'org.tool.Tool' },
  // No ABI, but the executable is an app-installed helper and the vendor has no app left (Adobe ARMDC case).
  [`${SYS_DAEMONS_DIR}/com.gonevendor.updater.plist`]: { Label: 'com.gonevendor.updater', ProgramArguments: ['/Library/PrivilegedHelperTools/com.gonevendor.updater'] },
  // Same helper-location pattern but the vendor still has an installed app → must stay unflagged.
  [`${SYS_DAEMONS_DIR}/com.alive.helperd.plist`]: { Label: 'com.alive.helperd', ProgramArguments: ['/Library/PrivilegedHelperTools/alive-helper'] },
  // Executable unreadable (EACCES) — absence cannot be confirmed → must stay unflagged.
  [`${SYS_DAEMONS_DIR}/com.locked.daemon.plist`]: { Label: 'com.locked.daemon', ProgramArguments: ['/protected/bin/tool'] },
}
export const INSTALLED_BUNDLE_IDS = new Set(['com.alive.App'])
export const SPOTLIGHT_PROBE_ID = 'com.apple.finder'

// /Library/LaunchAgents holds a symlink into an app bundle that was deleted (broken link).
export const BROKEN_SYMLINK = `${SYS_AGENTS_DIR}/com.deleted.helper.plist`
export const SYMLINK_TARGET = '/Applications/Deleted.app/Contents/Resources/com.deleted.helper.plist'

export const DIR_ENTRIES: Record<string, string[]> = {
  [USER_DIR]: ['com.gone.app.plist', 'com.live.app.plist', 'com.apple.thing.plist', 'com.bare.cmd.plist', 'com.nopgm.plist', 'com.epic.launcher.plist', 'com.gonegame.launcher.plist'],
  [SYS_AGENTS_DIR]: ['com.deleted.helper.plist'],
  [SYS_DAEMONS_DIR]: [
    'com.gonecorp.daemon.plist',
    'com.alive.daemon.plist',
    'org.tool.helper.plist',
    'com.gonevendor.updater.plist',
    'com.alive.helperd.plist',
    'com.locked.daemon.plist',
  ],
}

export const EXISTING_EXECUTABLES = new Set([
  '/usr/local/bin/live',
  '/Library/PrivilegedHelperTools/com.gonevendor.updater',
  '/Library/PrivilegedHelperTools/alive-helper',
  '/Applications/Epic Games Launcher.app', // installed → its `open` launcher stays unflagged
])

export function errnoError(code: string): NodeJS.ErrnoException {
  const err = new Error(code) as NodeJS.ErrnoException
  err.code = code
  return err
}

/** Paths "moved to Trash" by the mocked admin script — lstat reports them gone afterwards. */
