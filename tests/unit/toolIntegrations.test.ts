import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  shell: { trashItem: vi.fn().mockResolvedValue(undefined) }
}))

vi.mock('../../src/main/services/homebrewAnalyzer', () => ({
  scanHomebrew: vi.fn().mockResolvedValue({ tool: 'homebrew', status: 'ready', message: null, summary: [], reclaimable: [{ id: 'r1', tool: 'homebrew', path: '/tmp/brew-item', label: 'test', size: 100, category: 'cache', safetyLevel: 'safe' }], lastScannedAt: 1 })
}))

vi.mock('../../src/main/services/xcodeAnalyzer', () => ({
  scanXcode: vi.fn().mockResolvedValue({ tool: 'xcode', status: 'not_installed', message: null, summary: [], reclaimable: [], lastScannedAt: 1 })
}))

vi.mock('../../src/main/services/vscodeAnalyzer', () => ({
  scanVSCode: vi.fn().mockResolvedValue({ tool: 'vscode', status: 'ready', message: null, summary: [], reclaimable: [{ id: 'r2', tool: 'vscode', path: '/tmp/vscode-item', label: 'test', size: 200, category: 'cache', safetyLevel: 'safe' }], lastScannedAt: 1 })
}))

vi.mock('../../src/main/services/toolchainAnalyzer', () => ({
  scanToolchain: vi.fn().mockResolvedValue({ tool: 'toolchain', status: 'ready', message: null, summary: [], reclaimable: [], lastScannedAt: 1 })
}))

vi.mock('../../src/main/services/logging', () => ({
  logInfo: vi.fn(), logError: vi.fn(), logWarn: vi.fn()
}))

describe('toolIntegrations', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should scan all tools and build allowlist', async () => {
    const { scanAllTools } = await import('../../src/main/services/toolIntegrations')
    const results = await scanAllTools()

    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results.some((r) => r.tool === 'vscode')).toBe(true)
  })

  it('should reject clean request for path not in scan results', async () => {
    const { scanAllTools, cleanToolItems } = await import('../../src/main/services/toolIntegrations')
    await scanAllTools()

    const result = await cleanToolItems(['/etc/passwd'])
    expect(result.failed).toContain('/etc/passwd')
    expect(result.succeeded).toHaveLength(0)
  })

  it('should allow cleaning paths from scan results', async () => {
    const { scanAllTools, cleanToolItems } = await import('../../src/main/services/toolIntegrations')
    await scanAllTools()

    const result = await cleanToolItems(['/tmp/vscode-item'])
    expect(result.succeeded).toContain('/tmp/vscode-item')
    expect(result.failed).toHaveLength(0)
  })
})
