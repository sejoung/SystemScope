import dns from 'node:dns/promises'
import { createConcurrencyLimiter, runWithConcurrency } from '@main/services/core/runWithConcurrency'

const MAX_CACHE_ENTRIES = 4096
const DNS_LOOKUP_CONCURRENCY = 12
const cache = new Map<string, string | null>()
const pendingLookups = new Map<string, Promise<string | null>>()
const dnsLookupLimit = createConcurrencyLimiter(DNS_LOOKUP_CONCURRENCY)

export function __resetDnsCacheForTests(): void {
  cache.clear()
  pendingLookups.clear()
}

function setCache(ip: string, value: string | null): void {
  // Bound the cache to avoid unbounded growth over the lifetime of the process.
  // Map preserves insertion order, so deleting the first key evicts the oldest.
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.delete(oldest)
    }
  }
  cache.set(ip, value)
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

async function lookupOne(ip: string): Promise<string | null> {
  if (cache.has(ip)) return cache.get(ip) ?? null
  if (shouldSkip(ip)) {
    setCache(ip, null)
    return null
  }
  const pending = pendingLookups.get(ip)
  if (pending) return pending

  const request = dnsLookupLimit(async () => {
    try {
      const names = await dns.reverse(ip)
      const name = names[0] ?? null
      setCache(ip, name)
      return name
    } catch {
      setCache(ip, null)
      return null
    }
  }).finally(() => {
    if (pendingLookups.get(ip) === request) pendingLookups.delete(ip)
  })
  pendingLookups.set(ip, request)
  return request
}

export async function resolveHostnames(ips: string[]): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(ips))
  const entries: Array<readonly [string, string | null]> = Array(unique.length)
  await runWithConcurrency(unique.map((ip, index) => ({ ip, index })), DNS_LOOKUP_CONCURRENCY, async ({ ip, index }) => {
    entries[index] = [ip, await lookupOne(ip)] as const
  })
  return Object.fromEntries(entries)
}
