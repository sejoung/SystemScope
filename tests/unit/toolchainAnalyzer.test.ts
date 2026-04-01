import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/main/utils/getDirSize', () => ({
  getDirSizeEstimate: vi.fn().mockResolvedValue(1024 * 1024 * 200)
}))

vi.mock('../../src/main/services/logging', () => ({
  logInfo: vi.fn(), logError: vi.fn()
}))

vi.mock('../../src/main/utils/fsHelpers', () => ({
  dirExists: vi.fn().mockResolvedValue(false)
}))

describe('toolchainAnalyzer', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should return not_installed when no toolchain caches exist', async () => {
    const { dirExists } = await import('../../src/main/utils/fsHelpers')
    vi.mocked(dirExists).mockResolvedValue(false)

    const { scanToolchain } = await import('../../src/main/services/toolchainAnalyzer')
    const result = await scanToolchain()

    expect(result.tool).toBe('toolchain')
    expect(result.status).toBe('not_installed')
  })

  it('should detect npm cache when it exists', async () => {
    const { dirExists } = await import('../../src/main/utils/fsHelpers')
    vi.mocked(dirExists).mockImplementation(async (p: string) => {
      return p.includes('.npm') || p.includes('npm-cache')
    })

    const { scanToolchain } = await import('../../src/main/services/toolchainAnalyzer')
    const result = await scanToolchain()

    expect(result.status).toBe('ready')
    expect(result.summary).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'totalToolchains' })
    ]))
    expect(result.reclaimable.length).toBeGreaterThanOrEqual(0)
  })
})
