type GeoIpLookup = typeof import('geoip-country')['lookup']

const MAX_CACHE_ENTRIES = 4096
const cache = new Map<string, string | null>()
let lookupPromise: Promise<GeoIpLookup> | null = null

export function __resetGeoIpCacheForTests(): void {
  cache.clear()
  lookupPromise = null
}

const SKIP_PREFIXES = ['127.', '169.254.', 'fe80:', 'fe80::']
const SKIP_EXACT = new Set(['', '*', '0.0.0.0', '::', '::1'])

function setCache(ip: string, value: string | null): void {
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(ip)) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.delete(oldest)
    }
  }
  cache.set(ip, value)
}

function shouldSkip(ip: string): boolean {
  if (SKIP_EXACT.has(ip)) return true
  for (const p of SKIP_PREFIXES) {
    if (ip.startsWith(p)) return true
  }
  return false
}

async function getLookup(): Promise<GeoIpLookup> {
  lookupPromise ??= import('geoip-country').then((module) => module.lookup)
  return lookupPromise
}

function lookupOne(ip: string, lookup: GeoIpLookup): string | null {
  if (cache.has(ip)) return cache.get(ip) ?? null
  if (shouldSkip(ip)) {
    setCache(ip, null)
    return null
  }
  try {
    const result = lookup(ip)
    const country = result?.country ?? null
    setCache(ip, country)
    return country
  } catch {
    setCache(ip, null)
    return null
  }
}

export async function resolveCountries(ips: string[]): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(ips))
  const uncachedPublicIps = unique.filter((ip) => !cache.has(ip) && !shouldSkip(ip))
  const lookup = uncachedPublicIps.length > 0 ? await getLookup() : null
  const entries = unique.map((ip) => {
    if (cache.has(ip)) return [ip, cache.get(ip) ?? null] as const
    if (shouldSkip(ip) || !lookup) {
      setCache(ip, null)
      return [ip, null] as const
    }
    return [ip, lookupOne(ip, lookup)] as const
  })
  return Object.fromEntries(entries)
}
