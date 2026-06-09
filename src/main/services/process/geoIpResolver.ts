import { lookup } from 'geoip-country'

const cache = new Map<string, string | null>()

export function __resetGeoIpCacheForTests(): void {
  cache.clear()
}

const SKIP_PREFIXES = ['127.', '169.254.', 'fe80:', 'fe80::']
const SKIP_EXACT = new Set(['', '*', '0.0.0.0', '::', '::1'])

function shouldSkip(ip: string): boolean {
  if (SKIP_EXACT.has(ip)) return true
  for (const p of SKIP_PREFIXES) {
    if (ip.startsWith(p)) return true
  }
  return false
}

function lookupOne(ip: string): string | null {
  if (cache.has(ip)) return cache.get(ip) ?? null
  if (shouldSkip(ip)) {
    cache.set(ip, null)
    return null
  }
  try {
    const result = lookup(ip)
    const country = result?.country ?? null
    cache.set(ip, country)
    return country
  } catch {
    cache.set(ip, null)
    return null
  }
}

export async function resolveCountries(ips: string[]): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(ips))
  const entries = unique.map((ip) => [ip, lookupOne(ip)] as const)
  return Object.fromEntries(entries)
}
