import type { AppLeftoverDataItem, AppRelatedDataItem } from '@shared/types'

export function createRelatedDataItem(itemPath: string, label: string, source: string): AppRelatedDataItem {
  return {
    id: `${source}:${itemPath}`,
    label,
    path: itemPath,
    source
  }
}

export function dedupeByPath(items: AppRelatedDataItem[]): AppRelatedDataItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })
}

export function dedupeLeftoverByPath(items: AppLeftoverDataItem[]): AppLeftoverDataItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.path)) return false
    seen.add(item.path)
    return true
  })
}

export function applyCachedLeftoverSizes(items: AppLeftoverDataItem[], cache: Map<string, number>): void {
  for (const item of items) {
    const cachedSize = cache.get(item.path)
    if (cachedSize !== undefined) {
      item.sizeBytes = cachedSize
    }
  }
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return

  let currentIndex = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex
      currentIndex += 1
      await worker(items[index])
    }
  })

  await Promise.all(runners)
}
