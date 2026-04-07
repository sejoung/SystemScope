import { beforeEach, describe, expect, it, vi } from 'vitest'

const reverse = vi.hoisted(() => vi.fn<(ip: string) => Promise<string[]>>())
vi.mock('node:dns/promises', () => ({
  default: { reverse },
  reverse,
}))

import { resolveHostnames, __resetDnsCacheForTests } from '../../src/main/services/dnsResolver'

describe('resolveHostnames', () => {
  beforeEach(() => {
    __resetDnsCacheForTests()
    reverse.mockReset()
  })

  it('resolves a single IP and caches the result', async () => {
    reverse.mockResolvedValueOnce(['example.com'])
    const result = await resolveHostnames(['1.2.3.4'])
    expect(result).toEqual({ '1.2.3.4': 'example.com' })

    reverse.mockClear()
    const cached = await resolveHostnames(['1.2.3.4'])
    expect(cached).toEqual({ '1.2.3.4': 'example.com' })
    expect(reverse).not.toHaveBeenCalled()
  })

  it('returns null for IPs that fail to resolve and caches the negative result', async () => {
    reverse.mockRejectedValueOnce(new Error('ENOTFOUND'))
    const result = await resolveHostnames(['9.9.9.9'])
    expect(result).toEqual({ '9.9.9.9': null })

    reverse.mockClear()
    const cached = await resolveHostnames(['9.9.9.9'])
    expect(cached).toEqual({ '9.9.9.9': null })
    expect(reverse).not.toHaveBeenCalled()
  })

  it('skips empty / loopback / link-local / unspecified addresses without calling DNS', async () => {
    const result = await resolveHostnames(['', '0.0.0.0', '127.0.0.1', '::1', '169.254.1.2', '*'])
    expect(reverse).not.toHaveBeenCalled()
    expect(result).toEqual({
      '': null,
      '0.0.0.0': null,
      '127.0.0.1': null,
      '::1': null,
      '169.254.1.2': null,
      '*': null,
    })
  })

  it('deduplicates the input list before issuing lookups', async () => {
    reverse.mockResolvedValue(['host.example'])
    await resolveHostnames(['1.1.1.1', '1.1.1.1', '1.1.1.1'])
    expect(reverse).toHaveBeenCalledTimes(1)
  })

  it('processes multiple IPs in parallel and returns a complete map', async () => {
    reverse.mockImplementation(async (ip: string) => {
      if (ip === '1.1.1.1') return ['one.example']
      if (ip === '2.2.2.2') return ['two.example']
      throw new Error('ENOTFOUND')
    })
    const result = await resolveHostnames(['1.1.1.1', '2.2.2.2', '3.3.3.3'])
    expect(result).toEqual({
      '1.1.1.1': 'one.example',
      '2.2.2.2': 'two.example',
      '3.3.3.3': null,
    })
  })
})
