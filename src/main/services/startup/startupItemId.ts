import { createHash } from 'node:crypto'

/**
 * Stable id for a startup item, derived from its unique path (plist path, registry
 * key, …). Orphan removal matches scan results by this, so every producer must use it.
 */
export function startupItemId(uniquePath: string): string {
  return createHash('sha256').update(uniquePath).digest('hex').slice(0, 16)
}
