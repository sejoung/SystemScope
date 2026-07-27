import type { Systeminformation } from 'systeminformation'

const CPU_HISTORY_WINDOW_MS = 5 * 60 * 1000

interface ProcessCpuSample {
  timestamp: number
  cpu: number
}

interface ProcessCpuHistory {
  identity: string
  lastSeenAt: number
  samples: ProcessCpuSample[]
}

export interface ProcessCpuStats {
  average: number | null
  peak: number | null
  observedMs: number
}

const processCpuHistory = new Map<number, ProcessCpuHistory>()

function getProcessIdentity(
  processInfo: Systeminformation.ProcessesProcessData
): string {
  return `${processInfo.pid}:${processInfo.started ?? ''}:${processInfo.name ?? ''}:${processInfo.command ?? ''}`
}

export function recordProcessCpuSamples(
  list: Systeminformation.ProcessesProcessData[],
  timestamp: number
): void {
  const cutoff = timestamp - CPU_HISTORY_WINDOW_MS

  for (const processInfo of list) {
    const identity = getProcessIdentity(processInfo)
    const existing = processCpuHistory.get(processInfo.pid)
    const history: ProcessCpuHistory = existing?.identity === identity
      ? existing
      : { identity, lastSeenAt: timestamp, samples: [] }

    history.lastSeenAt = timestamp
    history.samples.push({
      timestamp,
      cpu: Number.isFinite(processInfo.cpu) ? Math.max(0, processInfo.cpu) : 0
    })

    const firstInWindow = history.samples.findIndex((sample) => sample.timestamp >= cutoff)
    if (firstInWindow > 0) {
      history.samples.splice(0, firstInWindow)
    }
    processCpuHistory.set(processInfo.pid, history)
  }

  for (const [pid, history] of processCpuHistory) {
    if (history.lastSeenAt < cutoff) {
      processCpuHistory.delete(pid)
    }
  }
}

export function getProcessCpuStats(
  processInfo: Systeminformation.ProcessesProcessData
): ProcessCpuStats {
  const history = processCpuHistory.get(processInfo.pid)
  if (
    !history
    || history.identity !== getProcessIdentity(processInfo)
    || history.samples.length === 0
  ) {
    return { average: null, peak: null, observedMs: 0 }
  }

  let total = 0
  let peak = 0
  for (const sample of history.samples) {
    total += sample.cpu
    peak = Math.max(peak, sample.cpu)
  }

  return {
    average: Math.round((total / history.samples.length) * 100) / 100,
    peak: Math.round(peak * 100) / 100,
    observedMs: Math.max(
      0,
      history.samples[history.samples.length - 1].timestamp - history.samples[0].timestamp
    )
  }
}

export function parseProcessStartedAt(
  started: string | undefined | null,
  now: number = Date.now()
): number | null {
  const value = started?.trim()
  if (!value) return null

  const isoLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T')
    : value
  const parsed = Date.parse(isoLike)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > now + 60_000) {
    return null
  }
  return parsed
}

export function isZombieProcessState(state: string | undefined | null): boolean {
  const normalized = state?.trim().toLowerCase()
  return normalized === 'zombie' || normalized === 'z'
}
