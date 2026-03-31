import { randomUUID } from 'node:crypto'
import type {
  CleanupInbox,
  CleanupInboxItem,
  CleanupPreviewItem,
  CleanupRule,
  CleanupRuleId
} from '@shared/types'
import { PersistentStore } from './persistentStore'
import { getCleanupInboxFilePath } from './dataDir'
import { previewCleanup, getCleanupRules } from './cleanupRules'
import { logInfo, logError } from './logging'

interface DismissedEntry {
  path: string
  dismissedAt: number
}

const DISMISSED_SCHEMA_VERSION = 1
const DISMISSED_MAX_ENTRIES = 5000
const DISMISSED_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

let dismissedPaths: Set<string> = new Set()

let dismissedStore: PersistentStore<DismissedEntry> | null = null

function getStore(): PersistentStore<DismissedEntry> {
  if (!dismissedStore) {
    dismissedStore = new PersistentStore<DismissedEntry>({
      filePath: getCleanupInboxFilePath(),
      schemaVersion: DISMISSED_SCHEMA_VERSION,
      maxEntries: DISMISSED_MAX_ENTRIES,
      maxAgeMs: DISMISSED_MAX_AGE_MS,
      getTimestamp: (entry) => entry.dismissedAt
    })
  }
  return dismissedStore
}

export async function initCleanupInbox(): Promise<void> {
  try {
    const store = getStore()
    const entries = await store.load()
    dismissedPaths = new Set(entries.map((e) => e.path))
    logInfo('cleanup-inbox', `Loaded ${dismissedPaths.size} dismissed paths`)
  } catch (err) {
    logError('cleanup-inbox', 'Failed to initialize cleanup inbox', err)
    dismissedPaths = new Set()
  }
}

export async function getCleanupInbox(): Promise<CleanupInbox> {
  const preview = await previewCleanup()
  const rules = await getCleanupRules()

  const ruleMap = new Map<CleanupRuleId, CleanupRule>()
  for (const rule of rules) {
    ruleMap.set(rule.id, rule)
  }

  const items: CleanupInboxItem[] = preview.items
    .filter((item) => !dismissedPaths.has(item.path))
    .map((item) => {
      const rule = ruleMap.get(item.rule)
      const category = rule?.category ?? 'system'
      return {
        id: randomUUID(),
        ruleId: item.rule,
        ruleName: rule?.name ?? item.rule,
        category,
        path: item.path,
        size: item.size,
        modifiedAt: item.modifiedAt,
        safetyLevel: determineSafety(category),
        reason: buildReason(item, rule)
      }
    })
    .sort((a, b) => b.size - a.size)

  const totalReclaimable = items.reduce((sum, item) => sum + item.size, 0)

  return {
    items,
    totalReclaimable,
    generatedAt: Date.now()
  }
}

export async function dismissInboxItem(itemPath: string): Promise<void> {
  dismissedPaths.add(itemPath)

  try {
    const store = getStore()
    await store.append({ path: itemPath, dismissedAt: Date.now() })
    logInfo('cleanup-inbox', `Dismissed item: ${itemPath}`)
  } catch (err) {
    logError('cleanup-inbox', 'Failed to persist dismissed item', err)
  }
}

function determineSafety(category: string): 'safe' | 'caution' | 'risky' {
  switch (category) {
    case 'package_managers':
    case 'docker':
    case 'system':
      return 'safe'
    case 'downloads':
      return 'caution'
    case 'dev_tools':
      return 'risky'
    default:
      return 'caution'
  }
}

function buildReason(item: CleanupPreviewItem, rule: CleanupRule | undefined): string {
  const sizeMB = (item.size / (1024 * 1024)).toFixed(1)
  const ageDays = Math.floor((Date.now() - item.modifiedAt) / (1000 * 60 * 60 * 24))

  if (rule) {
    return `${rule.name}: ${sizeMB} MB, not modified for ${ageDays} days`
  }
  return `${sizeMB} MB, not modified for ${ageDays} days`
}
