import { describe, expect, it } from 'vitest'
import { createConcurrencyLimiter, runWithConcurrency } from '../../src/main/services/core/runWithConcurrency'

describe('concurrency helpers', () => {
  it('processes every item with a bounded number of workers', async () => {
    let active = 0
    let maxActive = 0
    const completed: number[] = []
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await Promise.resolve()
      completed.push(item)
      active -= 1
    })

    expect(maxActive).toBe(2)
    expect(completed.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('normalizes zero and fractional concurrency instead of silently dropping work', async () => {
    const completed: number[] = []
    await runWithConcurrency([1, 2], 0, async (item) => { completed.push(item) })
    await runWithConcurrency([3, 4], 1.9, async (item) => { completed.push(item) })
    expect(completed).toEqual([1, 2, 3, 4])
  })

  it('does not invoke the worker for an empty input', async () => {
    let called = false
    await runWithConcurrency([], 2, async () => { called = true })
    expect(called).toBe(false)
  })

  it('releases limiter capacity after rejection so queued work can continue', async () => {
    const limit = createConcurrencyLimiter(1)
    const order: string[] = []
    const failed = limit(async () => {
      order.push('failed')
      throw new Error('expected')
    })
    const succeeded = limit(async () => {
      order.push('succeeded')
      return 42
    })

    await expect(failed).rejects.toThrow('expected')
    await expect(succeeded).resolves.toBe(42)
    expect(order).toEqual(['failed', 'succeeded'])
  })
})
