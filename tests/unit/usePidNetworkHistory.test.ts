import { describe, expect, it } from 'vitest'
import {
  reduceHistory,
  type MutableHistory,
} from '../../src/renderer/src/features/process/usePidNetworkHistory'
import type { ProcessNetworkSnapshot } from '@shared/types'

// NOTE: @testing-library/react is not a devDependency of this project (vitest
// environment is "node"). The hook delegates all logic to the pure reduceHistory
// function, which is tested here directly.

function snap(
  processes: Array<{ pid: number; rxBps: number | null; txBps: number | null }>
): ProcessNetworkSnapshot {
  return {
    supported: true,
    capturedAt: Date.now(),
    intervalSec: 2,
    processes: processes.map((p) => ({
      pid: p.pid,
      name: `p${p.pid}`,
      rxBps: p.rxBps,
      txBps: p.txBps,
      totalRxBytes: 0,
      totalTxBytes: 0,
    })),
  }
}

function makeMap(): Map<number, MutableHistory> {
  return new Map()
}

describe('reduceHistory (usePidNetworkHistory pure reducer)', () => {
  it('accumulates samples per PID, newest last', () => {
    const map = makeMap()
    reduceHistory(map, snap([{ pid: 1, rxBps: 10, txBps: 5 }]))
    reduceHistory(map, snap([{ pid: 1, rxBps: 20, txBps: 15 }]))
    const history = map.get(1)
    expect(history?.samples).toEqual([
      { rxBps: 10, txBps: 5 },
      { rxBps: 20, txBps: 15 },
    ])
  })

  it('treats null bps as 0', () => {
    const map = makeMap()
    reduceHistory(map, snap([{ pid: 1, rxBps: null, txBps: null }]))
    expect(map.get(1)?.samples).toEqual([{ rxBps: 0, txBps: 0 }])
  })

  it('evicts PIDs after more than 2 consecutive missing ticks', () => {
    const map = makeMap()
    reduceHistory(map, snap([{ pid: 1, rxBps: 10, txBps: 10 }]))
    reduceHistory(map, snap([]))  // missing 1
    reduceHistory(map, snap([]))  // missing 2
    expect(map.has(1)).toBe(true)
    reduceHistory(map, snap([]))  // missing 3 -> evicted
    expect(map.has(1)).toBe(false)
  })

  it('caps samples at MAX_SAMPLES (30)', () => {
    const map = makeMap()
    for (let i = 0; i < 35; i++) {
      reduceHistory(map, snap([{ pid: 1, rxBps: i, txBps: i }]))
    }
    expect(map.get(1)?.samples).toHaveLength(30)
    // newest sample should be the last one pushed
    expect(map.get(1)?.samples.at(-1)).toEqual({ rxBps: 34, txBps: 34 })
  })

  it('resets missingTicks when a PID reappears', () => {
    const map = makeMap()
    reduceHistory(map, snap([{ pid: 1, rxBps: 10, txBps: 10 }]))
    reduceHistory(map, snap([]))  // missing 1
    reduceHistory(map, snap([]))  // missing 2
    // reappears — should reset counter
    reduceHistory(map, snap([{ pid: 1, rxBps: 5, txBps: 5 }]))
    reduceHistory(map, snap([]))  // missing 1 again
    reduceHistory(map, snap([]))  // missing 2 again
    expect(map.has(1)).toBe(true)  // still alive (only 2 misses)
    reduceHistory(map, snap([]))  // missing 3 -> evicted
    expect(map.has(1)).toBe(false)
  })
})
