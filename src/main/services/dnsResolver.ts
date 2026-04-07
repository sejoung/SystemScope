import dns from 'node:dns/promises'

const cache = new Map<string, string | null>()

export function __resetDnsCacheForTests(): void {
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

async function lookupOne(ip: string): Promise<string | null> {
  if (cache.has(ip)) return cache.get(ip) ?? null
  if (shouldSkip(ip)) {
    cache.set(ip, null)
    return null
  }
  try {
    const names = await dns.reverse(ip)
    const name = names[0] ?? null
    cache.set(ip, name)
    return name
  } catch {
    cache.set(ip, null)
    return null
  }
}

export async function resolveHostnames(ips: string[]): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(ips))
  const entries = await Promise.all(unique.map(async (ip) => [ip, await lookupOne(ip)] as const))
  return Object.fromEntries(entries)
}
