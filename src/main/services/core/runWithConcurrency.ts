/** Run an async worker over items with at most `concurrency` workers in flight. */
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
