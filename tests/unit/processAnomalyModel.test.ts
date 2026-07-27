import { describe, expect, it } from 'vitest'
import type { ProcessInfo } from '../../src/shared/types'
import {
  DEFAULT_LONG_RUNNING_THRESHOLD_MS,
  formatProcessDuration,
  getProcessAnomalyEntries,
  getProcessAnomalyKinds,
  isLikelySystemProcess
} from '../../src/renderer/src/features/process/processAnomalies'

function processInfo(overrides: Partial<ProcessInfo> = {}): ProcessInfo {
  return {
    pid: 100,
    ppid: 10,
    parentName: 'shell',
    descendantCount: 0,
    name: 'node',
    cpu: 0,
    cpuAverage5m: 0,
    cpuPeak5m: 0,
    cpuObservedMs: 5 * 60 * 1000,
    memory: 1,
    memoryBytes: 1_024,
    startedAt: Date.now() - 60 * 60 * 1000,
    uptimeMs: 60 * 60 * 1000,
    state: 'sleeping',
    user: 'developer',
    command: 'node server.js',
    ...overrides
  }
}

describe('process anomaly model', () => {
  it('classifies long-running, sustained CPU, current CPU, and zombie processes', () => {
    expect(getProcessAnomalyKinds(
      processInfo(),
      DEFAULT_LONG_RUNNING_THRESHOLD_MS
    )).toEqual(['long_running'])

    expect(getProcessAnomalyKinds(
      processInfo({ cpu: 70, cpuAverage5m: 55 }),
      DEFAULT_LONG_RUNNING_THRESHOLD_MS
    )).toEqual(['sustained_cpu', 'long_running'])

    expect(getProcessAnomalyKinds(
      processInfo({ cpu: 90, cpuAverage5m: 10 }),
      DEFAULT_LONG_RUNNING_THRESHOLD_MS
    )).toEqual(['high_cpu', 'long_running'])

    expect(getProcessAnomalyKinds(
      processInfo({ state: 'zombie', uptimeMs: 1_000 }),
      DEFAULT_LONG_RUNNING_THRESHOLD_MS
    )).toEqual(['zombie'])
  })

  it('does not claim sustained CPU until at least one minute was observed', () => {
    const kinds = getProcessAnomalyKinds(
      processInfo({
        cpu: 20,
        cpuAverage5m: 95,
        cpuObservedMs: 59_999,
        uptimeMs: 1_000
      }),
      DEFAULT_LONG_RUNNING_THRESHOLD_MS
    )

    expect(kinds).toEqual([])
  })

  it('hides system processes that are only long-running while retaining real anomalies', () => {
    const longRunningSystem = processInfo({ pid: 2, user: 'root' })
    const zombieSystem = processInfo({
      pid: 3,
      user: 'root',
      state: 'zombie',
      uptimeMs: 1_000
    })

    expect(isLikelySystemProcess(longRunningSystem)).toBe(true)
    expect(getProcessAnomalyEntries(
      [longRunningSystem, zombieSystem],
      DEFAULT_LONG_RUNNING_THRESHOLD_MS,
      false
    ).map((entry) => entry.process.pid)).toEqual([3])

    expect(getProcessAnomalyEntries(
      [longRunningSystem, zombieSystem],
      DEFAULT_LONG_RUNNING_THRESHOLD_MS,
      true
    )).toHaveLength(2)
  })

  it('formats runtimes without implying false precision', () => {
    expect(formatProcessDuration(null)).toBe('—')
    expect(formatProcessDuration(20_000)).toBe('< 1m')
    expect(formatProcessDuration(10 * 60_000)).toBe('10m')
    expect(formatProcessDuration(2 * 60 * 60_000 + 5 * 60_000)).toBe('2h 5m')
    expect(formatProcessDuration(8 * 24 * 60 * 60_000)).toBe('8d')
  })
})
