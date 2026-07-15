/** Run an async worker over items with at most `concurrency` workers in flight. */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return

  const limit = Math.max(1, Math.floor(concurrency))
  let currentIndex = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex
      currentIndex += 1
      await worker(items[index])
    }
  })

  await Promise.all(runners)
}

export type ConcurrencyLimiter = <T>(task: () => Promise<T>) => Promise<T>

/** Share one concurrency budget across nested async work such as recursive scans. */
export function createConcurrencyLimiter(concurrency: number): ConcurrencyLimiter {
  const limit = Math.max(1, Math.floor(concurrency))
  let activeCount = 0
  const waiters: Array<() => void> = []

  const acquire = async (): Promise<void> => {
    if (activeCount < limit) {
      activeCount += 1
      return
    }
    await new Promise<void>((resolve) => {
      waiters.push(resolve)
    })
    activeCount += 1
  }

  const release = (): void => {
    activeCount -= 1
    waiters.shift()?.()
  }

  return async <T>(task: () => Promise<T>): Promise<T> => {
    await acquire()
    try {
      return await task()
    } finally {
      release()
    }
  }
}
