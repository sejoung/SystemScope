import { beforeEach, describe, expect, it, vi } from 'vitest'

const runExternalCommand = vi.hoisted(() => vi.fn())
vi.mock('../../src/main/services/core/externalCommand', () => ({
  runExternalCommand,
  isExternalCommandError: (error: unknown) => error !== null && typeof error === 'object' && 'kind' in error,
}))
vi.mock('../../src/main/services/core/logging', () => ({ logWarn: vi.fn() }))
vi.mock('../../src/main/i18n', () => ({ tk: (key: string) => key }))

import { normalizeDockerError, runDockerJsonLines, validateDockerId } from '../../src/main/services/docker/dockerCommand'
import {
  normalizeByteLabel,
  normalizeReclaimableLabel,
  parseDockerSize,
  parseReclaimedLabel,
  toDockerBuildCacheSummary,
  toDockerContainerSummary,
  toDockerImageSummary,
} from '../../src/main/services/docker/dockerMappers'

describe('Docker helpers', () => {
  beforeEach(() => runExternalCommand.mockReset())

  it('validates identifiers without permitting shell metacharacters or empty values', () => {
    expect(validateDockerId('sha256:abc-123/image_name')).toBe(true)
    for (const id of ['', '-starts-with-dash', 'abc def', 'abc;rm', '$(whoami)']) expect(validateDockerId(id)).toBe(false)
  })

  it('parses valid JSON lines while skipping blanks and malformed output', async () => {
    runExternalCommand.mockResolvedValue({ stdout: '\n{"id":1}\nnot-json\n{"id":2}\n', stderr: '' })
    await expect(runDockerJsonLines<{ id: number }>(['ps'])).resolves.toEqual({
      status: 'ready',
      rows: [{ id: 1 }, { id: 2 }],
      message: null,
    })
  })

  it('distinguishes a missing CLI from an unavailable daemon', async () => {
    runExternalCommand.mockRejectedValueOnce({ kind: 'command_not_found', message: 'missing' })
    await expect(runDockerJsonLines(['info'])).resolves.toMatchObject({ status: 'not_installed', rows: [] })
    runExternalCommand.mockRejectedValueOnce(new Error('permission denied'))
    await expect(runDockerJsonLines(['info'])).resolves.toMatchObject({ status: 'daemon_unavailable', rows: [] })
  })

  it('normalizes Docker byte labels and reclaimed output', () => {
    expect(parseDockerSize('1.5GB')).toBe(Math.round(1.5 * 1024 ** 3))
    expect(parseDockerSize('12.3MB (virtual 1.2GB)')).toBe(Math.round(12.3 * 1024 ** 2))
    expect(parseDockerSize('invalid')).toBe(0)
    expect(normalizeByteLabel('1,024MB')).toBe('1024 MB')
    expect(normalizeReclaimableLabel('2.9GB (82%)')).toBe('2.9 GB')
    expect(parseReclaimedLabel('Total reclaimed space: 3.4GB\n')).toBe('3.4 GB')
  })

  it('rejects incomplete rows and maps defaults consistently', () => {
    expect(toDockerImageSummary({}, new Map())).toBeNull()
    expect(toDockerContainerSummary({ ID: 'abc', Status: 'Restarting (1)' })).toMatchObject({ running: false, name: '-' })
    expect(toDockerImageSummary({ ID: 'sha256:abcdef1234567890' }, new Map())).toMatchObject({ shortId: 'abcdef123456', dangling: true })
    expect(toDockerBuildCacheSummary({ TotalCount: 'bad', Active: '2', Size: '1GB', Reclaimable: '' })).toMatchObject({ totalCount: 0, activeCount: 2, reclaimableBytes: 0 })
  })

  it('prefers stderr when normalizing command errors', () => {
    expect(normalizeDockerError({ stderr: ' denied ', message: 'fallback' }, 'unknown')).toBe('denied')
    expect(normalizeDockerError('bad', 'unknown')).toBe('unknown')
  })
})
