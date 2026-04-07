import { beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => vi.fn<(ip: string) => { country: string } | null>())
vi.mock('geoip-country', () => ({
  default: { lookup },
  lookup,
}))

import { resolveCountries, __resetGeoIpCacheForTests } from '../../src/main/services/geoIpResolver'

describe('resolveCountries', () => {
  beforeEach(() => {
    __resetGeoIpCacheForTests()
    lookup.mockReset()
  })

  it('looks up an IP and caches the result', async () => {
    lookup.mockReturnValueOnce({ country: 'US' })
    const result = await resolveCountries(['8.8.8.8'])
    expect(result).toEqual({ '8.8.8.8': 'US' })

    lookup.mockClear()
    const cached = await resolveCountries(['8.8.8.8'])
    expect(cached).toEqual({ '8.8.8.8': 'US' })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('returns null for IPs the database does not know, and caches the negative', async () => {
    lookup.mockReturnValueOnce(null)
    const result = await resolveCountries(['203.0.113.1'])
    expect(result).toEqual({ '203.0.113.1': null })

    lookup.mockClear()
    await resolveCountries(['203.0.113.1'])
    expect(lookup).not.toHaveBeenCalled()
  })

  it('skips empty / loopback / link-local / unspecified addresses', async () => {
    const result = await resolveCountries(['', '0.0.0.0', '127.0.0.1', '::1', '169.254.1.2', '*'])
    expect(lookup).not.toHaveBeenCalled()
    expect(result).toEqual({
      '': null,
      '0.0.0.0': null,
      '127.0.0.1': null,
      '::1': null,
      '169.254.1.2': null,
      '*': null,
    })
  })

  it('deduplicates input IPs', async () => {
    lookup.mockReturnValue({ country: 'KR' })
    await resolveCountries(['1.1.1.1', '1.1.1.1', '1.1.1.1'])
    expect(lookup).toHaveBeenCalledTimes(1)
  })
})
