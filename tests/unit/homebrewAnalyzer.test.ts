import { beforeEach, describe, expect, it, vi } from 'vitest'

const runExternalCommand = vi.hoisted(() => vi.fn())

vi.mock('../../src/main/services/externalCommand', () => ({
  runExternalCommand,
  isExternalCommandError: (error: unknown) => {
    return Boolean(error) && typeof error === 'object' && 'kind' in (error as Record<string, unknown>)
  }
}))

vi.mock('../../src/main/utils/getDirSize', () => ({
  getDirSizeEstimate: vi.fn().mockResolvedValue(1024 * 1024 * 50)
}))

vi.mock('../../src/main/services/logging', () => ({
  logInfo: vi.fn(), logDebug: vi.fn(), logError: vi.fn()
}))

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    access: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ size: 1024 * 1024 * 10, isDirectory: () => false })
  }
})

describe('homebrewAnalyzer', () => {
  beforeEach(() => {
    vi.resetModules()
    runExternalCommand.mockReset()
  })

  it('should return not_installed when brew binary is not found', async () => {
    const { access } = await import('node:fs/promises')
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'))

    const { scanHomebrew } = await import('../../src/main/services/homebrewAnalyzer')
    const result = await scanHomebrew()

    expect(result.tool).toBe('homebrew')
    expect(result.status).toBe('not_installed')
    expect(result.summary).toEqual([])
  })

  it('should parse formulae and cask counts from brew list output', async () => {
    const { access } = await import('node:fs/promises')
    vi.mocked(access).mockResolvedValue(undefined)

    runExternalCommand.mockImplementation(async (_bin: string, args: string[]) => {
      const joined = args.join(' ')
      if (joined.includes('list --formula')) return { stdout: 'node\npython\ngit\n', stderr: '' }
      if (joined.includes('list --cask')) return { stdout: 'visual-studio-code\nfigma\n', stderr: '' }
      if (joined.includes('outdated')) return { stdout: 'node\n', stderr: '' }
      if (joined.includes('--cellar')) return { stdout: '/opt/homebrew/Cellar\n', stderr: '' }
      if (joined.includes('cleanup --dry-run')) return { stdout: '', stderr: '' }
      return { stdout: '', stderr: '' }
    })

    const { scanHomebrew } = await import('../../src/main/services/homebrewAnalyzer')
    const result = await scanHomebrew()

    expect(result.status).toBe('ready')
    expect(result.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'formulae', value: '3' }),
        expect.objectContaining({ key: 'casks', value: '2' }),
        expect.objectContaining({ key: 'outdated', value: '1' })
      ])
    )
  })

  it('should return ready with zero counts when individual brew commands fail', async () => {
    const { access } = await import('node:fs/promises')
    vi.mocked(access).mockResolvedValue(undefined)

    runExternalCommand.mockRejectedValue({ kind: 'execution_failed', message: 'brew failed', stdout: '', stderr: '' })

    const { scanHomebrew } = await import('../../src/main/services/homebrewAnalyzer')
    const result = await scanHomebrew()

    // Individual command failures are caught internally, so status is still 'ready'
    expect(result.status).toBe('ready')
    expect(result.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'formulae', value: '0' }),
        expect.objectContaining({ key: 'casks', value: '0' })
      ])
    )
  })
})
