import { PersistentStore } from './persistentStore'
import { getMetricsFilePath, ensureDataDir } from './dataDir'
import { getSystemStats } from './systemMonitor'
import { getTopCpuProcesses } from './processMonitor'
import { getSettings } from '../store/settingsStore'
import { logInfo, logWarn, logError } from './logging'
import type { MetricPoint, MetricPointDetail, TimelineRange, TimelineData, TimelineAlert } from '@shared/types/metric'

const SCHEMA_VERSION = 1
const MS_PER_DAY = 24 * 60 * 60 * 1000

let store: PersistentStore<MetricPoint> | null = null
let collectionTimer: ReturnType<typeof setInterval> | null = null

export async function initMetricsStore(): Promise<void> {
  const { history } = getSettings()
  const maxAgeMs = history.metricsRetentionDays * MS_PER_DAY

  await ensureDataDir()

  store = new PersistentStore<MetricPoint>({
    filePath: getMetricsFilePath(),
    schemaVersion: SCHEMA_VERSION,
    maxAgeMs,
    getTimestamp: (entry) => entry.ts
  })

  await store.load()

  const intervalMs = history.metricsIntervalSec * 1000
  collectionTimer = setInterval(() => {
    void collectAndStore()
  }, intervalMs)

  logInfo('metrics-store', 'Metrics store initialized', {
    intervalSec: history.metricsIntervalSec,
    retentionDays: history.metricsRetentionDays
  })
}

export function stopMetricsStore(): void {
  if (collectionTimer) {
    clearInterval(collectionTimer)
    collectionTimer = null
  }
  store = null
  logInfo('metrics-store', 'Metrics store stopped')
}

export async function collectMetricPoint(): Promise<MetricPoint> {
  const stats = await getSystemStats()

  const rootDrive = stats.disk.drives.find((d) => d.mount === '/' || d.mount === 'C:\\')

  const point: MetricPoint = {
    ts: stats.timestamp,
    cpu: stats.cpu.usage,
    memory: stats.memory.usage,
    memoryUsedBytes: stats.memory.used,
    memoryTotalBytes: stats.memory.total,
    diskUsagePercent: rootDrive ? rootDrive.usage : 0,
    diskReadBytesPerSec: stats.disk.io.readsPerSecond ?? 0,
    diskWriteBytesPerSec: stats.disk.io.writesPerSecond ?? 0,
    networkRxBytesPerSec: stats.network.downloadBytesPerSecond ?? 0,
    networkTxBytesPerSec: stats.network.uploadBytesPerSecond ?? 0
  }

  if (stats.gpu.available && stats.gpu.usage !== null) {
    point.gpuUsage = stats.gpu.usage
  }
  if (stats.gpu.available && stats.gpu.memoryTotal !== null && stats.gpu.memoryUsed !== null && stats.gpu.memoryTotal > 0) {
    point.gpuMemoryUsage = Math.round((stats.gpu.memoryUsed / stats.gpu.memoryTotal) * 10000) / 100
  }

  return point
}

export async function getTimelineData(range: TimelineRange): Promise<TimelineData> {
  if (!store) {
    return { range, points: [], alerts: [] }
  }

  const entries = await store.load()
  const now = Date.now()

  let cutoffMs: number
  switch (range) {
    case '24h':
      cutoffMs = now - 24 * 60 * 60 * 1000
      break
    case '7d':
      cutoffMs = now - 7 * MS_PER_DAY
      break
    case '30d':
      cutoffMs = now - 30 * MS_PER_DAY
      break
  }

  const filtered = entries.filter((p) => p.ts >= cutoffMs)

  let points: MetricPoint[]
  switch (range) {
    case '24h':
      points = filtered
      break
    case '7d':
      points = downsample(filtered, 5 * 60 * 1000)
      break
    case '30d':
      points = downsample(filtered, 15 * 60 * 1000)
      break
  }

  const alerts: TimelineAlert[] = []

  return { range, points, alerts }
}

export async function getPointDetail(timestamp: number): Promise<MetricPointDetail | null> {
  if (!store) return null

  const entries = await store.load()
  if (entries.length === 0) return null

  let closest = entries[0]
  let closestDiff = Math.abs(entries[0].ts - timestamp)

  for (let i = 1; i < entries.length; i++) {
    const diff = Math.abs(entries[i].ts - timestamp)
    if (diff < closestDiff) {
      closest = entries[i]
      closestDiff = diff
    }
  }

  let topProcesses: MetricPointDetail['topProcesses'] = []

  const isRecent = Date.now() - closest.ts < 60 * 1000
  if (isRecent) {
    try {
      const procs = await getTopCpuProcesses(10)
      topProcesses = procs.map((p) => ({
        name: p.name,
        pid: p.pid,
        cpu: p.cpu,
        memory: p.memory
      }))
    } catch (err) {
      logWarn('metrics-store', 'Failed to get top processes for point detail', { error: err })
    }
  }

  return { ...closest, topProcesses }
}

// ── Internal helpers ──

async function collectAndStore(): Promise<void> {
  if (!store) return

  try {
    const point = await collectMetricPoint()
    await store.append(point)
  } catch (err) {
    logError('metrics-store', 'Failed to collect metric point', { error: err })
  }
}

function downsample(points: MetricPoint[], bucketMs: number): MetricPoint[] {
  if (points.length === 0) return []

  const buckets = new Map<number, MetricPoint[]>()

  for (const p of points) {
    const bucketKey = Math.floor(p.ts / bucketMs)
    const bucket = buckets.get(bucketKey)
    if (bucket) {
      bucket.push(p)
    } else {
      buckets.set(bucketKey, [p])
    }
  }

  const result: MetricPoint[] = []

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b)

  for (const key of sortedKeys) {
    const bucket = buckets.get(key)!
    result.push(averageBucket(bucket))
  }

  return result
}

function averageBucket(points: MetricPoint[]): MetricPoint {
  const len = points.length
  if (len === 1) return points[0]

  let cpu = 0
  let memory = 0
  let memoryUsedBytes = 0
  let memoryTotalBytes = 0
  let diskUsagePercent = 0
  let diskReadBytesPerSec = 0
  let diskWriteBytesPerSec = 0
  let networkRxBytesPerSec = 0
  let networkTxBytesPerSec = 0
  let gpuUsageSum = 0
  let gpuUsageCount = 0
  let gpuMemoryUsageSum = 0
  let gpuMemoryUsageCount = 0

  for (const p of points) {
    cpu += p.cpu
    memory += p.memory
    memoryUsedBytes += p.memoryUsedBytes
    memoryTotalBytes += p.memoryTotalBytes
    diskUsagePercent += p.diskUsagePercent
    diskReadBytesPerSec += p.diskReadBytesPerSec
    diskWriteBytesPerSec += p.diskWriteBytesPerSec
    networkRxBytesPerSec += p.networkRxBytesPerSec
    networkTxBytesPerSec += p.networkTxBytesPerSec

    if (p.gpuUsage !== undefined) {
      gpuUsageSum += p.gpuUsage
      gpuUsageCount++
    }
    if (p.gpuMemoryUsage !== undefined) {
      gpuMemoryUsageSum += p.gpuMemoryUsage
      gpuMemoryUsageCount++
    }
  }

  const avg: MetricPoint = {
    ts: points[Math.floor(len / 2)].ts,
    cpu: round2(cpu / len),
    memory: round2(memory / len),
    memoryUsedBytes: Math.round(memoryUsedBytes / len),
    memoryTotalBytes: Math.round(memoryTotalBytes / len),
    diskUsagePercent: round2(diskUsagePercent / len),
    diskReadBytesPerSec: Math.round(diskReadBytesPerSec / len),
    diskWriteBytesPerSec: Math.round(diskWriteBytesPerSec / len),
    networkRxBytesPerSec: Math.round(networkRxBytesPerSec / len),
    networkTxBytesPerSec: Math.round(networkTxBytesPerSec / len)
  }

  if (gpuUsageCount > 0) {
    avg.gpuUsage = round2(gpuUsageSum / gpuUsageCount)
  }
  if (gpuMemoryUsageCount > 0) {
    avg.gpuMemoryUsage = round2(gpuMemoryUsageSum / gpuMemoryUsageCount)
  }

  return avg
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
