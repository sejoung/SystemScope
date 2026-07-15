import { useEffect, useRef, useState } from 'react'
import type { ProcessNetworkSnapshot } from '@shared/types'

export interface PidHistorySample {
  rxBps: number
  txBps: number
}

export interface PidHistory {
  samples: PidHistorySample[]   // oldest → newest
}

export const MAX_SAMPLES = 30
export const MAX_MISSING_TICKS = 2

export interface MutableHistory extends PidHistory {
  missingTicks: number
}

/**
 * Pure reducer: given the current history map and a new snapshot,
 * returns an updated map. The input map is mutated in-place and returned.
 * Null bps values are recorded as 0 so the sparkline has a baseline.
 * Processes absent for more than MAX_MISSING_TICKS consecutive snapshots
 * are evicted from the history map.
 */
export function reduceHistory(
  map: Map<number, MutableHistory>,
  snapshot: ProcessNetworkSnapshot
): Map<number, MutableHistory> {
  const seen = new Set<number>()

  for (const proc of snapshot.processes) {
    seen.add(proc.pid)
    let entry = map.get(proc.pid)
    if (!entry) {
      entry = { samples: [], missingTicks: 0 }
      map.set(proc.pid, entry)
    }
    entry.missingTicks = 0
    entry.samples = [
      ...entry.samples,
      { rxBps: proc.rxBps ?? 0, txBps: proc.txBps ?? 0 },
    ].slice(-MAX_SAMPLES)
  }

  for (const [pid, entry] of map) {
    if (seen.has(pid)) continue
    entry.missingTicks += 1
    if (entry.missingTicks > MAX_MISSING_TICKS) {
      map.delete(pid)
    }
  }

  return map
}

/**
 * Maintains a per-PID ring buffer of rx/tx bps samples.
 * Delegates to reduceHistory for testability.
 */
export function usePidNetworkHistory(snapshot: ProcessNetworkSnapshot | null): Map<number, PidHistory> {
  const mapRef = useRef<Map<number, MutableHistory>>(new Map())
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!snapshot) return
    reduceHistory(mapRef.current, snapshot)
    setVersion((v) => v + 1)
  }, [snapshot])

  // Return a read-only view. The version bump above triggers re-render.
  void version
  return mapRef.current
}
