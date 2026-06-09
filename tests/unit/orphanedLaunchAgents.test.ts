import { beforeEach, describe, expect, it, vi } from 'vitest'

const readdirMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn())
const runMock = vi.hoisted(() => vi.fn())
const trashMock = vi.hoisted(() => vi.fn())

vi.mock('node:os', () => ({
  homedir: () => '/Users/test',
  platform: () => 'darwin',
}))

vi.mock('node:fs/promises', () => ({
  readdir: readdirMock,
  access: accessMock,
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

const DIR = '/Users/test/Library/LaunchAgents'
const PLISTS: Record<string, Record<string, unknown>> = {
  [`${DIR}/com.gone.app.plist`]: { Label: 'com.gone.app', ProgramArguments: ['/Applications/Gone.app/Contents/MacOS/Gone'] },
  [`${DIR}/com.live.app.plist`]: { Label: 'com.live.app', Program: '/usr/local/bin/live' },
  [`${DIR}/com.apple.thing.plist`]: { Label: 'com.apple.thing', ProgramArguments: ['/Applications/Gone2.app/x'] },
  [`${DIR}/com.bare.cmd.plist`]: { Label: 'com.bare.cmd', ProgramArguments: ['osascript', '-e', 'x'] },
  [`${DIR}/com.nopgm.plist`]: { Label: 'com.nopgm', KeepAlive: true },
}
const EXISTING_EXECUTABLES = new Set(['/usr/local/bin/live'])

describe('orphaned launch agents', () => {
  beforeEach(() => {
    vi.resetModules()
    readdirMock.mockReset()
    accessMock.mockReset()
    runMock.mockReset()
    trashMock.mockReset()

    readdirMock.mockResolvedValue(Object.keys(PLISTS).map((p) => p.split('/').pop() as string))
    accessMock.mockImplementation(async (p: string) => {
      if (EXISTING_EXECUTABLES.has(p)) return
      throw new Error('ENOENT')
    })
    runMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'plutil') {
        const plistPath = args[args.length - 1]
        return { stdout: JSON.stringify(PLISTS[plistPath] ?? {}), stderr: '' }
      }
      return { stdout: '', stderr: '' } // launchctl
    })
    trashMock.mockResolvedValue(undefined)
  })

  it('flags only user agents whose absolute executable is missing', async () => {
    const { findOrphanedLaunchAgents } = await import('../../src/main/services/apps/startupManager')
    const orphans = await findOrphanedLaunchAgents()

    expect(orphans.map((o) => o.label)).toEqual(['com.gone.app'])
    expect(orphans[0]).toMatchObject({
      label: 'com.gone.app',
      plistPath: `${DIR}/com.gone.app.plist`,
      missingExecutable: '/Applications/Gone.app/Contents/MacOS/Gone',
      scope: 'user',
    })
  })

  it('unloads and trashes a confirmed orphan, reporting the count', async () => {
    const mod = await import('../../src/main/services/apps/startupManager')
    const orphans = await mod.findOrphanedLaunchAgents()
    const id = orphans[0].id

    const result = await mod.removeOrphanedLaunchAgents([id])

    expect(runMock).toHaveBeenCalledWith('launchctl', ['unload', `${DIR}/com.gone.app.plist`], expect.anything())
    expect(trashMock).toHaveBeenCalledWith(`${DIR}/com.gone.app.plist`)
    expect(result).toMatchObject({ removedCount: 1, failedCount: 0 })
    expect(result.removedPaths).toEqual([`${DIR}/com.gone.app.plist`])
  })

  it('rejects ids that are not currently orphaned (no trashing)', async () => {
    const { removeOrphanedLaunchAgents } = await import('../../src/main/services/apps/startupManager')
    const result = await removeOrphanedLaunchAgents(['deadbeefdeadbeef'])

    expect(trashMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ removedCount: 0, failedCount: 1 })
  })
})
