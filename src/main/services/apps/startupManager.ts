import { platform } from 'node:os'
import type { StartupItem, StartupToggleResult } from '@shared/types'
import { logInfo, logError } from '@main/services/core/logging'
import { getMacStartupItems, findMacStartupItemById, toggleMacItem } from './startupItems.mac'
import { getWindowsStartupItems, toggleWindowsItem } from './startupItems.windows'

// Platform dispatch for the startup-items feature. The real work lives in:
//   startupItems.mac.ts     — launchd listing, friendly names, toggling
//   startupItems.windows.ts — registry/startup-folder listing and toggling
//   launchdOrphans.mac.ts   — leftover-plist detection and removal
export { findOrphanedLaunchAgents, removeOrphanedLaunchAgents } from './launchdOrphans.mac'

export async function getStartupItems(): Promise<StartupItem[]> {
  const p = platform()
  if (p === 'darwin') return getMacStartupItems()
  if (p === 'win32') return getWindowsStartupItems()
  return []
}

export async function toggleStartupItem(id: string, enabled: boolean): Promise<StartupToggleResult> {
  const p = platform()

  // On macOS the id is derived from the plist path, so the item can be located
  // directly without re-parsing every plist (and re-running Spotlight lookups).
  let item: StartupItem | null | undefined
  if (p === 'darwin') {
    item = await findMacStartupItemById(id)
  } else {
    item = (await getStartupItems()).find((i) => i.id === id)
  }
  if (!item) {
    return { id, enabled, success: false, error: 'Startup item not found' }
  }

  try {
    if (p === 'darwin') {
      await toggleMacItem(item, enabled)
    } else if (p === 'win32') {
      await toggleWindowsItem(item, enabled)
    }
    logInfo('startup-manager', `Startup item ${enabled ? 'enabled' : 'disabled'}: ${item.name}`, { id, path: item.path })
    return { id, enabled, success: true, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to toggle startup item'
    logError('startup-manager', 'Failed to toggle startup item', { id, error: err })
    return { id, enabled, success: false, error: message }
  }
}
