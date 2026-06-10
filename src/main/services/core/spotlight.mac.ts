import { runExternalCommand } from '@main/services/core/externalCommand'

// All bundle-id → app-path resolution goes through one cached helper. The cache is
// module-level with a TTL so repeated scans (tab visits, the pre-removal re-scan,
// friendly-name derivation) don't re-pay Spotlight queries for the same ids.

const MDFIND_TIMEOUT_MS = 10000
const MDFIND_CACHE_TTL_MS = 5 * 60 * 1000
const mdfindCache = new Map<string, { paths: string[] | null; at: number }>()

/** Result of the last Spotlight health probe (see spotlightIndexAvailable). */
let spotlightProbe: { available: boolean; at: number } | null = null

/**
 * Resolve the indexed paths for a bundle id (or vendor glob like "com.adobe.*") via
 * Spotlight. Returns null when the answer cannot be trusted: the query contains
 * characters that would break the mdfind expression, mdfind itself fails, or
 * Spotlight indexing is unavailable — callers must treat null as "unknown",
 * never as "not installed".
 */
export async function mdfindBundlePaths(bundleQuery: string, onlyIn?: string[]): Promise<string[] | null> {
  // Quotes/backslashes would break out of the query string; reject rather than escape.
  // ('*' is allowed — vendor globs rely on it.)
  if (/["\\]/.test(bundleQuery)) return null

  const key = `${onlyIn?.join('|') ?? ''}::${bundleQuery}`
  const cached = mdfindCache.get(key)
  if (cached && Date.now() - cached.at < MDFIND_CACHE_TTL_MS) return cached.paths

  let paths: string[] | null
  try {
    const onlyInArgs = (onlyIn ?? []).flatMap((dir) => ['-onlyin', dir])
    const { stdout } = await runExternalCommand(
      'mdfind',
      [...onlyInArgs, `kMDItemCFBundleIdentifier == "${bundleQuery}"`],
      { timeout: MDFIND_TIMEOUT_MS }
    )
    paths = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
    // An empty result is only meaningful when the index itself is healthy.
    if (paths.length === 0 && !(await spotlightIndexAvailable())) paths = null
  } catch {
    paths = null
  }

  mdfindCache.set(key, { paths, at: Date.now() })
  return paths
}

/**
 * Whether Spotlight indexing currently returns results at all, probed by looking up
 * com.apple.finder (always installed). When indexing is off or mid-rebuild the probe
 * comes back empty, and empty lookups must not be read as "app not installed".
 */
async function spotlightIndexAvailable(): Promise<boolean> {
  if (spotlightProbe && Date.now() - spotlightProbe.at < MDFIND_CACHE_TTL_MS) return spotlightProbe.available

  let available: boolean
  try {
    const { stdout } = await runExternalCommand('mdfind', ['kMDItemCFBundleIdentifier == "com.apple.finder"'], {
      timeout: MDFIND_TIMEOUT_MS,
    })
    available = stdout.trim().length > 0
  } catch {
    available = false
  }
  spotlightProbe = { available, at: Date.now() }
  return available
}
