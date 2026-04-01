import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/main/utils/getDirSize', () => ({
  getDirSizeEstimate: vi.fn().mockResolvedValue(1024 * 1024 * 30)
}))

vi.mock('../../src/main/services/logging', () => ({
  logInfo: vi.fn(), logDebug: vi.fn(), logError: vi.fn()
}))

vi.mock('../../src/main/utils/fsHelpers', () => ({
  dirExists: vi.fn().mockResolvedValue(false)
}))

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    access: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ size: 1024 * 1024, isDirectory: () => false })
  }
})

describe('vscodeAnalyzer', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should return not_installed when VS Code directories do not exist', async () => {
    const { dirExists } = await import('../../src/main/utils/fsHelpers')
    vi.mocked(dirExists).mockResolvedValue(false)

    const { scanVSCode } = await import('../../src/main/services/vscodeAnalyzer')
    const result = await scanVSCode()

    expect(result.tool).toBe('vscode')
    expect(result.status).toBe('not_installed')
  })

  it('should return ready with extension count when VS Code is found', async () => {
    const { dirExists } = await import('../../src/main/utils/fsHelpers')
    vi.mocked(dirExists).mockResolvedValue(true)

    const { readdir } = await import('node:fs/promises')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(vi.mocked(readdir) as any).mockResolvedValue([
      { name: 'publisher.ext-1.0.0', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
      { name: 'publisher.ext-2.0.0', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
    ])

    const { scanVSCode } = await import('../../src/main/services/vscodeAnalyzer')
    const result = await scanVSCode()

    expect(result.status).toBe('ready')
    expect(result.summary).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'extensionCount', value: '2' })
    ]))
  })
})
