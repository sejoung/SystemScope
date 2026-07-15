import { beforeEach, describe, expect, it, vi } from 'vitest'

const readdirMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn())
const lstatMock = vi.hoisted(() => vi.fn())
const readlinkMock = vi.hoisted(() => vi.fn())
const unlinkMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())
const runMock = vi.hoisted(() => vi.fn())
const trashMock = vi.hoisted(() => vi.fn())

vi.mock('node:os', () => ({
  homedir: () => '/Users/test',
  platform: () => 'darwin',
  tmpdir: () => '/tmp',
}))

vi.mock('node:fs/promises', () => ({
  readdir: readdirMock,
  access: accessMock,
  lstat: lstatMock,
  readlink: readlinkMock,
  unlink: unlinkMock,
  writeFile: writeFileMock,
}))

vi.mock('electron', () => ({
  shell: { trashItem: trashMock },
}))

vi.mock('../../src/main/services/core/externalCommand', () => ({
  runExternalCommand: runMock,
  isExternalCommandError: () => false,
}))

vi.mock('../../src/main/services/core/logging', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
}))

import { USER_DIR, SYS_DAEMONS_DIR, PLISTS, INSTALLED_BUNDLE_IDS, SPOTLIGHT_PROBE_ID, BROKEN_SYMLINK, SYMLINK_TARGET, DIR_ENTRIES, EXISTING_EXECUTABLES, errnoError } from './startupManager.fixtures'

let movedToTrash: Set<string>

async function baseRun(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  if (cmd === 'plutil') {
    const plistPath = args[args.length - 1]
    return { stdout: JSON.stringify(PLISTS[plistPath] ?? {}), stderr: '' }
  }
  if (cmd === 'mdfind') {
    const target = /"([^"]+)"/.exec(args[args.length - 1])?.[1] ?? ''
    if (target === SPOTLIGHT_PROBE_ID) return { stdout: '/System/Library/CoreServices/Finder.app\n', stderr: '' }
    const installed = target.endsWith('.*')
      ? [...INSTALLED_BUNDLE_IDS].some((id) => id.startsWith(target.slice(0, -1)))
      : INSTALLED_BUNDLE_IDS.has(target)
    return { stdout: installed ? '/Applications/Alive.app\n' : '', stderr: '' }
  }
  if (cmd === 'osascript') {
    const script = args[args.length - 1]
    for (const match of script.matchAll(/mv -f '([^']+)'/g)) movedToTrash.add(match[1])
    return { stdout: '', stderr: '' }
  }
  return { stdout: '', stderr: '' } // launchctl
}

describe('orphaned launch agents', () => {
  beforeEach(() => {
    vi.resetModules()
    readdirMock.mockReset()
    accessMock.mockReset()
    lstatMock.mockReset()
    readlinkMock.mockReset()
    unlinkMock.mockReset()
    writeFileMock.mockReset()
    runMock.mockReset()
    trashMock.mockReset()
    movedToTrash = new Set()

    readdirMock.mockImplementation(async (dir: string) => {
      const entries = DIR_ENTRIES[dir]
      if (!entries) throw errnoError('ENOENT')
      return entries
    })
    lstatMock.mockImplementation(async (p: string) => {
      if (movedToTrash.has(p)) throw errnoError('ENOENT')
      return { isSymbolicLink: () => p === BROKEN_SYMLINK }
    })
    readlinkMock.mockResolvedValue(SYMLINK_TARGET)
    accessMock.mockImplementation(async (p: string) => {
      if (EXISTING_EXECUTABLES.has(p)) return
      if (p.startsWith('/protected/')) throw errnoError('EACCES')
      throw errnoError('ENOENT')
    })
    runMock.mockImplementation(baseRun)
    trashMock.mockResolvedValue(undefined)
    unlinkMock.mockResolvedValue(undefined)
    writeFileMock.mockResolvedValue(undefined)
  })

  it('flags missing-executable plists across user and system dirs, plus broken symlinks', async () => {
    const { findOrphanedLaunchAgents } = await import('../../src/main/services/startup')
    const orphans = await findOrphanedLaunchAgents()

    expect(orphans.map((o) => o.label).sort()).toEqual([
      'com.deleted.helper',
      'com.gone.app',
      'com.gonecorp.daemon',
      'com.gonegame.launcher',
      'com.gonevendor.updater',
      'org.tool.helper',
    ])
    // `open <app>` launcher: the missing target is the .app the plist opens, not `open` itself.
    expect(orphans.find((o) => o.label === 'com.gonegame.launcher')).toMatchObject({
      missingExecutable: '/Applications/Gone Game.app',
      scope: 'user',
      reason: 'missing_executable',
    })
    expect(orphans.find((o) => o.label === 'com.gone.app')).toMatchObject({
      plistPath: `${USER_DIR}/com.gone.app.plist`,
      missingExecutable: '/Applications/Gone.app/Contents/MacOS/Gone',
      scope: 'user',
      kind: 'launch_agent',
      reason: 'missing_executable',
    })
    expect(orphans.find((o) => o.label === 'com.deleted.helper')).toMatchObject({
      plistPath: BROKEN_SYMLINK,
      missingExecutable: SYMLINK_TARGET,
      scope: 'system',
      kind: 'launch_agent',
      reason: 'broken_symlink',
    })
    expect(orphans.find((o) => o.label === 'com.gonecorp.daemon')).toMatchObject({
      plistPath: `${SYS_DAEMONS_DIR}/com.gonecorp.daemon.plist`,
      scope: 'system',
      kind: 'launch_daemon',
      reason: 'missing_executable',
    })
    // Executable exists but the owning app is gone — flagged via AssociatedBundleIdentifiers.
    // com.alive.daemon (same executable, but its app IS installed) must stay unflagged.
    expect(orphans.find((o) => o.label === 'org.tool.helper')).toMatchObject({
      plistPath: `${SYS_DAEMONS_DIR}/org.tool.helper.plist`,
      missingExecutable: 'org.tool.Tool',
      scope: 'system',
      kind: 'launch_daemon',
      reason: 'missing_app',
    })
    // No ABI, but a PrivilegedHelperTools executable whose vendor has no app left (Adobe ARMDC case).
    // com.alive.helperd (same location, vendor app installed) must stay unflagged.
    expect(orphans.find((o) => o.label === 'com.gonevendor.updater')).toMatchObject({
      missingExecutable: 'com.gonevendor.*',
      scope: 'system',
      kind: 'launch_daemon',
      reason: 'missing_app',
    })
  })

  it('never flags executables whose absence cannot be confirmed (EACCES is not ENOENT)', async () => {
    const { findOrphanedLaunchAgents } = await import('../../src/main/services/startup')
    const orphans = await findOrphanedLaunchAgents()

    expect(orphans.find((o) => o.label === 'com.locked.daemon')).toBeUndefined()
  })

  it('does not flag missing-app candidates when mdfind is unavailable', async () => {
    runMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'mdfind') throw new Error('command_not_found')
      return baseRun(cmd, args)
    })

    const { findOrphanedLaunchAgents } = await import('../../src/main/services/startup')
    const orphans = await findOrphanedLaunchAgents()

    expect(orphans.find((o) => o.label === 'org.tool.helper')).toBeUndefined()
    // High-confidence detections are unaffected.
    expect(orphans.map((o) => o.label).sort()).toEqual(['com.deleted.helper', 'com.gone.app', 'com.gonecorp.daemon', 'com.gonegame.launcher'])
  })

  it('does not flag missing-app candidates when Spotlight indexing is off (empty results even for the probe)', async () => {
    runMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'mdfind') return { stdout: '', stderr: '' } // index off: everything comes back empty
      return baseRun(cmd, args)
    })

    const { findOrphanedLaunchAgents } = await import('../../src/main/services/startup')
    const orphans = await findOrphanedLaunchAgents()

    expect(orphans.map((o) => o.label).sort()).toEqual(['com.deleted.helper', 'com.gone.app', 'com.gonecorp.daemon', 'com.gonegame.launcher'])
  })

  it('unloads and trashes a confirmed user orphan, reporting the count', async () => {
    const mod = await import('../../src/main/services/startup')
    const orphans = await mod.findOrphanedLaunchAgents()
    const id = orphans.find((o) => o.label === 'com.gone.app')!.id

    const result = await mod.removeOrphanedLaunchAgents([id])

    expect(runMock).toHaveBeenCalledWith('launchctl', ['unload', `${USER_DIR}/com.gone.app.plist`], expect.anything())
    expect(trashMock).toHaveBeenCalledWith(`${USER_DIR}/com.gone.app.plist`)
    expect(result).toMatchObject({ removedCount: 1, failedCount: 0 })
    expect(result.removedPaths).toEqual([`${USER_DIR}/com.gone.app.plist`])
  })

  it('removes system orphans through a single osascript admin prompt', async () => {
    const mod = await import('../../src/main/services/startup')
    const orphans = await mod.findOrphanedLaunchAgents()
    const systemOrphans = orphans.filter((o) => o.scope === 'system')

    const result = await mod.removeOrphanedLaunchAgents(systemOrphans.map((o) => o.id))

    const osascriptCalls = runMock.mock.calls.filter(([cmd]) => cmd === 'osascript')
    expect(osascriptCalls).toHaveLength(1) // one auth prompt for the whole batch
    const args = osascriptCalls[0][1] as string[]
    expect(args).toContain('do shell script (item 1 of argv) with administrator privileges')
    const script = args[args.length - 1]
    expect(script).toContain(BROKEN_SYMLINK)
    expect(script).toContain(`${SYS_DAEMONS_DIR}/com.gonecorp.daemon.plist`)
    expect(script).toContain(`${SYS_DAEMONS_DIR}/org.tool.helper.plist`) // missing-app orphans are removable too
    expect(script).toContain('launchctl bootout system') // daemons get booted out first
    expect(script).toContain('launchctl bootout gui/') // ...and so do system-located agents, in the gui session
    // Trash names are suffixed with the per-path id, so same-named plists can't collide.
    for (const orphan of systemOrphans) {
      expect(script).toContain(`/Users/test/.Trash/${orphan.label.replace(/'/g, '')}.${orphan.id}.plist`)
    }
    expect(trashMock).not.toHaveBeenCalled() // root-owned files never go through shell.trashItem
    expect(result).toMatchObject({ removedCount: 4, failedCount: 0 })
  })

  it('reports items still present after the admin script as failed (no blind success)', async () => {
    const mod = await import('../../src/main/services/startup')
    const orphans = await mod.findOrphanedLaunchAgents()
    const systemIds = orphans.filter((o) => o.scope === 'system').map((o) => o.id)

    const stuckPath = `${SYS_DAEMONS_DIR}/com.gonecorp.daemon.plist`
    runMock.mockImplementation(async (cmd: string, args: string[]) => {
      const result = await baseRun(cmd, args)
      if (cmd === 'osascript') movedToTrash.delete(stuckPath) // this mv silently failed
      return result
    })

    const result = await mod.removeOrphanedLaunchAgents(systemIds)

    expect(result).toMatchObject({ removedCount: 3, failedCount: 1 })
    expect(result.removedPaths).not.toContain(stuckPath)
    expect(result.errors.some((e) => e.includes('com.gonecorp.daemon'))).toBe(true)
  })

  it('reports all system orphans as failed when the admin prompt is canceled', async () => {
    const mod = await import('../../src/main/services/startup')
    const orphans = await mod.findOrphanedLaunchAgents()
    const systemIds = orphans.filter((o) => o.scope === 'system').map((o) => o.id)

    runMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'osascript') throw new Error('execution error: User canceled. (-128)')
      return baseRun(cmd, args)
    })

    const result = await mod.removeOrphanedLaunchAgents(systemIds)

    expect(result).toMatchObject({ removedCount: 0, failedCount: 4 })
    expect(result.errors.every((e) => /canceled/i.test(e))).toBe(true)
  })

  it('derives friendly display names like macOS System Settings does', async () => {
    const mod = await import('../../src/main/services/startup')
    const items = await mod.getStartupItems()
    const byLabel = (label: string) => items.find((i) => i.label === label)!

    // .app bundle mentioned in program arguments wins
    expect(byLabel('com.epic.launcher').name).toBe('Epic Games Launcher')
    // no .app path → resolved via AssociatedBundleIdentifiers + Spotlight
    expect(byLabel('com.alive.daemon').name).toBe('Alive')
    // nothing to resolve → humanized reverse-DNS label
    expect(byLabel('com.live.app').name).toBe('Live App')
    // single-word labels stay as-is
    expect(byLabel('com.nopgm').name).toBe('Nopgm')
  })

  it('toggles a system daemon through the admin prompt instead of writing next to the plist', async () => {
    const mod = await import('../../src/main/services/startup')
    const items = await mod.getStartupItems()
    const daemon = items.find((i) => i.label === 'com.alive.daemon')!

    const result = await mod.toggleStartupItem(daemon.id, false)

    expect(result.success).toBe(true)
    // The rewritten plist is staged in the temp dir, never beside the root-owned original.
    expect(writeFileMock.mock.calls[0][0]).toMatch(/^\/tmp\/systemscope-toggle-/)
    const osascriptCalls = runMock.mock.calls.filter(([cmd]) => cmd === 'osascript')
    expect(osascriptCalls).toHaveLength(1)
    const script = (osascriptCalls[0][1] as string[]).at(-1)!
    expect(script).toContain('cp -f')
    expect(script).toContain(daemon.path)
    expect(script).toContain('launchctl bootout system')
  })

  it('still toggles user agents in place without an admin prompt', async () => {
    const mod = await import('../../src/main/services/startup')
    const items = await mod.getStartupItems()
    const agent = items.find((i) => i.label === 'com.live.app')!

    const result = await mod.toggleStartupItem(agent.id, false)

    expect(result.success).toBe(true)
    expect(writeFileMock.mock.calls[0][0]).toBe(`${agent.path}.tmp.json`)
    expect(runMock.mock.calls.filter(([cmd]) => cmd === 'osascript')).toHaveLength(0)
    expect(runMock).toHaveBeenCalledWith('launchctl', ['unload', agent.path], expect.anything())
  })

  it('refuses to toggle a symlinked plist (writing through it would modify the app bundle)', async () => {
    const mod = await import('../../src/main/services/startup')
    const orphans = await mod.findOrphanedLaunchAgents()
    const id = orphans.find((o) => o.plistPath === BROKEN_SYMLINK)!.id

    const result = await mod.toggleStartupItem(id, false)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/link into its app bundle/)
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('rejects ids that are not currently orphaned (no trashing)', async () => {
    const { removeOrphanedLaunchAgents } = await import('../../src/main/services/startup')
    const result = await removeOrphanedLaunchAgents(['deadbeefdeadbeef'])

    expect(trashMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ removedCount: 0, failedCount: 1 })
  })
})
