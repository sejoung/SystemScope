import { randomUUID } from 'node:crypto'
import type {
  DiagnosisCategory,
  DiagnosisResult,
  DiagnosisSummary,
  DiagnosisSeverity
} from '@shared/types'
import { getSystemStats } from './systemMonitor'
import { getTopCpuProcesses } from './processMonitor'
import { runQuickScan } from './quickScan'
import { listDockerContainers, listDockerImages, listDockerVolumes } from './dockerImages'
import { logInfo, logWarn, logError } from './logging'
import { formatBytes } from '@shared/utils/formatBytes'
import { getProjectMonitorSummary } from './projectMonitor'

interface DiagnosisRule {
  category: DiagnosisCategory
  evaluate: () => Promise<DiagnosisResult | null>
}

const SEVERITY_ORDER: Record<DiagnosisSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2
}

const DEFAULT_INTERVAL_SEC = 300 // 5 minutes
const CACHE_TTL_MS = 60_000

let cachedSummary: DiagnosisSummary | null = null
let cachedAt = 0
let diagnosisTimer: ReturnType<typeof setInterval> | null = null

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const rules: DiagnosisRule[] = [
  // Rule 1: Memory Pressure
  {
    category: 'memory_pressure',
    async evaluate(): Promise<DiagnosisResult | null> {
      const stats = await getSystemStats()
      const memUsage = stats.memory.usage
      const swapUsed = stats.memory.swapUsed

      if (memUsage <= 85 || swapUsed <= 0) return null

      const severity: DiagnosisSeverity = memUsage > 95 ? 'critical' : 'warning'
      return {
        id: randomUUID(),
        category: 'memory_pressure',
        severity,
        title: 'High Memory Pressure',
        description: `Memory usage is at ${memUsage}% with swap actively in use.`,
        evidence: [
          { label: 'Memory Usage', value: `${memUsage}%`, threshold: '85%' },
          { label: 'Swap Used', value: formatBytes(swapUsed) }
        ],
        actions: [
          { label: 'View processes by memory', targetPage: 'process' },
          { label: 'Save snapshot', actionId: 'save_snapshot' }
        ],
        detectedAt: Date.now()
      }
    }
  },

  // Rule 2: CPU Runaway Process
  {
    category: 'cpu_runaway',
    async evaluate(): Promise<DiagnosisResult | null> {
      const stats = await getSystemStats()
      const cpuUsage = stats.cpu.usage

      if (cpuUsage <= 80) return null

      const topProcesses = await getTopCpuProcesses(5)
      const runaway = topProcesses.find((p) => p.cpu > 50)
      if (!runaway) return null

      const severity: DiagnosisSeverity = cpuUsage > 90 ? 'critical' : 'warning'
      return {
        id: randomUUID(),
        category: 'cpu_runaway',
        severity,
        title: 'CPU Runaway Process Detected',
        description: `Overall CPU at ${cpuUsage}% — process "${runaway.name}" is using ${runaway.cpu}% CPU.`,
        evidence: [
          { label: 'Overall CPU', value: `${cpuUsage}%`, threshold: '80%' },
          { label: 'Process', value: runaway.name },
          { label: 'Process CPU', value: `${runaway.cpu}%`, threshold: '50%' }
        ],
        actions: [
          { label: 'View process details', targetPage: 'process' },
          { label: 'Save snapshot', actionId: 'save_snapshot' }
        ],
        detectedAt: Date.now()
      }
    }
  },

  // Rule 3: Disk Bottleneck
  {
    category: 'disk_bottleneck',
    async evaluate(): Promise<DiagnosisResult | null> {
      const stats = await getSystemStats()
      const io = stats.disk.io

      if (!io) return null

      const busyPercent = io.busyPercent
      if (busyPercent === null || busyPercent < 80) return null

      return {
        id: randomUUID(),
        category: 'disk_bottleneck',
        severity: 'warning',
        title: 'Disk I/O Bottleneck',
        description: `Disk is ${busyPercent}% busy, which may cause system slowdowns.`,
        evidence: [
          { label: 'Disk Busy', value: `${busyPercent}%`, threshold: '80%' },
          ...(io.readsPerSecond !== null ? [{ label: 'Reads/sec', value: `${io.readsPerSecond}` }] : []),
          ...(io.writesPerSecond !== null ? [{ label: 'Writes/sec', value: `${io.writesPerSecond}` }] : [])
        ],
        actions: [
          { label: 'Check disk activity', targetPage: 'dashboard' }
        ],
        detectedAt: Date.now()
      }
    }
  },

  // Rule 4: Low Disk Space
  {
    category: 'disk_space_low',
    async evaluate(): Promise<DiagnosisResult | null> {
      const stats = await getSystemStats()
      let worstDrive: { usage: number; mount: string; available: number } | null = null

      for (const drive of stats.disk.drives) {
        const effectiveUsage = drive.realUsage ?? drive.usage
        if (effectiveUsage > 85) {
          if (!worstDrive || effectiveUsage > worstDrive.usage) {
            worstDrive = { usage: effectiveUsage, mount: drive.mount, available: drive.available }
          }
        }
      }

      if (!worstDrive) return null

      const severity: DiagnosisSeverity = worstDrive.usage > 95 ? 'critical' : 'warning'
      return {
        id: randomUUID(),
        category: 'disk_space_low',
        severity,
        title: 'Low Disk Space',
        description: `Drive "${worstDrive.mount}" is ${worstDrive.usage.toFixed(1)}% full with ${formatBytes(worstDrive.available)} remaining.`,
        evidence: [
          { label: 'Disk Usage', value: `${worstDrive.usage.toFixed(1)}%`, threshold: '85%' },
          { label: 'Free Space', value: formatBytes(worstDrive.available) },
          { label: 'Mount', value: worstDrive.mount }
        ],
        actions: [
          { label: 'Analyze storage', targetPage: 'disk' }
        ],
        detectedAt: Date.now()
      }
    }
  },

  // Rule 5: Docker Reclaimable Space
  {
    category: 'docker_reclaimable',
    async evaluate(): Promise<DiagnosisResult | null> {
      let stoppedContainers = 0
      let danglingImages = 0
      let unusedVolumes = 0

      try {
        const [containerResult, imageResult, volumeResult] = await Promise.all([
          listDockerContainers(),
          listDockerImages(),
          listDockerVolumes()
        ])

        // Docker not available — skip silently
        if (containerResult.status !== 'ready' && imageResult.status !== 'ready' && volumeResult.status !== 'ready') {
          return null
        }

        if (containerResult.status === 'ready') {
          stoppedContainers = containerResult.containers.filter((c) => !c.running).length
        }
        if (imageResult.status === 'ready') {
          danglingImages = imageResult.images.filter((i) => i.dangling).length
        }
        if (volumeResult.status === 'ready') {
          unusedVolumes = volumeResult.volumes.filter((v) => !v.inUse).length
        }
      } catch {
        // Docker not installed or unavailable — skip this rule
        return null
      }

      if (stoppedContainers === 0 && danglingImages === 0 && unusedVolumes === 0) return null

      const parts: string[] = []
      if (stoppedContainers > 0) parts.push(`${stoppedContainers} stopped container(s)`)
      if (danglingImages > 0) parts.push(`${danglingImages} dangling image(s)`)
      if (unusedVolumes > 0) parts.push(`${unusedVolumes} unused volume(s)`)

      return {
        id: randomUUID(),
        category: 'docker_reclaimable',
        severity: 'info',
        title: 'Docker Reclaimable Resources',
        description: `Found ${parts.join(', ')} that can be cleaned up.`,
        evidence: [
          ...(stoppedContainers > 0 ? [{ label: 'Stopped Containers', value: `${stoppedContainers}` }] : []),
          ...(danglingImages > 0 ? [{ label: 'Dangling Images', value: `${danglingImages}` }] : []),
          ...(unusedVolumes > 0 ? [{ label: 'Unused Volumes', value: `${unusedVolumes}` }] : [])
        ],
        actions: [
          { label: 'Open Docker resources', targetPage: 'docker' },
          { label: 'Run cleanup preview', targetPage: 'cleanup', actionId: 'run_cleanup_preview' }
        ],
        detectedAt: Date.now()
      }
    }
  },

  // Rule 6: Cache Bloat
  {
    category: 'cache_bloat',
    async evaluate(): Promise<DiagnosisResult | null> {
      const folders = await runQuickScan()
      const cleanableFolders = folders.filter((f) => f.cleanable && f.size > 0)
      const totalReclaimable = cleanableFolders.reduce((sum, f) => sum + f.size, 0)

      const FIVE_GB = 5 * 1024 * 1024 * 1024
      const TWENTY_GB = 20 * 1024 * 1024 * 1024

      if (totalReclaimable < FIVE_GB) return null

      const severity: DiagnosisSeverity = totalReclaimable >= TWENTY_GB ? 'warning' : 'info'
      const topCategories = cleanableFolders
        .sort((a, b) => b.size - a.size)
        .slice(0, 3)
        .map((f) => `${f.name} (${formatBytes(f.size)})`)

      return {
        id: randomUUID(),
        category: 'cache_bloat',
        severity,
        title: 'Significant Cache / Reclaimable Space',
        description: `${formatBytes(totalReclaimable)} of reclaimable space detected across caches and temporary files.`,
        evidence: [
          { label: 'Total Reclaimable', value: formatBytes(totalReclaimable), threshold: '5 GB' },
          { label: 'Top Categories', value: topCategories.join(', ') }
        ],
        actions: [
          { label: 'Review cleanup targets', targetPage: 'disk' },
          { label: 'Run cleanup preview', targetPage: 'cleanup', actionId: 'run_cleanup_preview' }
        ],
        detectedAt: Date.now()
      }
    }
  },

  // Rule 7: High Swap Usage
  {
    category: 'swap_usage',
    async evaluate(): Promise<DiagnosisResult | null> {
      const stats = await getSystemStats()
      const swapUsed = stats.memory.swapUsed
      const swapTotal = stats.memory.swapTotal

      const TWO_GB = 2 * 1024 * 1024 * 1024
      if (swapUsed < TWO_GB) return null

      return {
        id: randomUUID(),
        category: 'swap_usage',
        severity: 'warning',
        title: 'High Swap Usage',
        description: `${formatBytes(swapUsed)} of swap is in use, which may degrade performance.`,
        evidence: [
          { label: 'Swap Used', value: formatBytes(swapUsed), threshold: '2 GB' },
          { label: 'Swap Total', value: formatBytes(swapTotal) }
        ],
        actions: [
          { label: 'View memory consumers', targetPage: 'process' },
          { label: 'Save snapshot', actionId: 'save_snapshot' }
        ],
        detectedAt: Date.now()
      }
    }
  },

  // Rule 8: Network Saturation
  {
    category: 'network_saturation',
    async evaluate(): Promise<DiagnosisResult | null> {
      const stats = await getSystemStats()
      const rx = stats.network.downloadBytesPerSecond
      const tx = stats.network.uploadBytesPerSecond

      const HUNDRED_MB = 100 * 1024 * 1024
      if ((rx === null || rx < HUNDRED_MB) && (tx === null || tx < HUNDRED_MB)) return null

      return {
        id: randomUUID(),
        category: 'network_saturation',
        severity: 'info',
        title: 'High Network Throughput',
        description: 'Network throughput exceeds 100 MB/s, which may impact other network-dependent tasks.',
        evidence: [
          ...(rx !== null ? [{ label: 'Download', value: `${formatBytes(rx)}/s`, threshold: '100 MB/s' }] : []),
          ...(tx !== null ? [{ label: 'Upload', value: `${formatBytes(tx)}/s`, threshold: '100 MB/s' }] : [])
        ],
        actions: [
          { label: 'View network activity', targetPage: 'dashboard' }
        ],
        detectedAt: Date.now()
      }
    }
  },

  {
    category: 'storage_growth',
    async evaluate(): Promise<DiagnosisResult | null> {
      const summary = await getProjectMonitorSummary()
      const GROWTH_THRESHOLD = 1024 * 1024 * 1024
      if (summary.totalRecentGrowthBytes < GROWTH_THRESHOLD) return null

      return {
        id: randomUUID(),
        category: 'storage_growth',
        severity: summary.totalRecentGrowthBytes >= 5 * GROWTH_THRESHOLD ? 'warning' : 'info',
        title: 'Recent Storage Growth Detected',
        description: `${formatBytes(summary.totalRecentGrowthBytes)} of recent growth was detected across monitored workspaces.`,
        evidence: [
          { label: 'Recent Growth', value: formatBytes(summary.totalRecentGrowthBytes), threshold: '1 GB' },
          { label: 'Tracked Workspaces', value: `${summary.workspaces.length}` }
        ],
        actions: [
          { label: 'Review cleanup targets', targetPage: 'cleanup', actionId: 'run_cleanup_preview' },
          { label: 'Refresh project monitor', targetPage: 'dashboard', actionId: 'refresh_project_monitor' }
        ],
        detectedAt: Date.now()
      }
    }
  },

  {
    category: 'workspace_growth',
    async evaluate(): Promise<DiagnosisResult | null> {
      const summary = await getProjectMonitorSummary()
      const largest = [...summary.workspaces].sort((left, right) => right.recentGrowthBytes - left.recentGrowthBytes)[0]
      if (!largest || largest.recentGrowthBytes < 512 * 1024 * 1024) return null

      return {
        id: randomUUID(),
        category: 'workspace_growth',
        severity: largest.recentGrowthBytes >= 2 * 1024 * 1024 * 1024 ? 'warning' : 'info',
        title: 'Workspace Growth Hotspot',
        description: `Workspace "${largest.name}" grew by ${formatBytes(largest.recentGrowthBytes)} since the previous scan.`,
        evidence: [
          { label: 'Workspace', value: largest.name },
          { label: 'Growth', value: formatBytes(largest.recentGrowthBytes), threshold: '512 MB' },
          { label: 'Current Size', value: formatBytes(largest.currentSize) }
        ],
        actions: [
          { label: 'Inspect storage growth', targetPage: 'disk', actionId: 'open_growth' },
          { label: 'Refresh project monitor', targetPage: 'dashboard', actionId: 'refresh_project_monitor' },
          { label: 'Open workspace folder', actionId: `open_path:${largest.path}` }
        ],
        detectedAt: Date.now()
      }
    }
  }
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initDiagnosisAdvisor(): Promise<void> {
  logInfo('diagnosis-advisor', 'Initializing diagnosis advisor')

  // Run initial diagnosis
  try {
    await runDiagnosis()
  } catch (err) {
    logWarn('diagnosis-advisor', 'Initial diagnosis run failed', { error: err })
  }

  // Start periodic diagnosis
  const intervalMs = DEFAULT_INTERVAL_SEC * 1000
  diagnosisTimer = setInterval(() => {
    void runDiagnosis().catch((err) => {
      logWarn('diagnosis-advisor', 'Periodic diagnosis run failed', { error: err })
    })
  }, intervalMs)

  logInfo('diagnosis-advisor', 'Diagnosis advisor started', { intervalSec: DEFAULT_INTERVAL_SEC })
}

export function stopDiagnosisAdvisor(): void {
  if (diagnosisTimer) {
    clearInterval(diagnosisTimer)
    diagnosisTimer = null
  }
  logInfo('diagnosis-advisor', 'Diagnosis advisor stopped')
}

export async function getDiagnosisSummary(): Promise<DiagnosisSummary> {
  const now = Date.now()
  if (cachedSummary && now - cachedAt < CACHE_TTL_MS) {
    return cachedSummary
  }
  return runDiagnosis()
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function runDiagnosis(): Promise<DiagnosisSummary> {
  const results: DiagnosisResult[] = []

  const evaluations = await Promise.allSettled(
    rules.map(async (rule) => {
      try {
        return await rule.evaluate()
      } catch (err) {
        logWarn('diagnosis-advisor', `Rule "${rule.category}" failed`, { error: err })
        return null
      }
    })
  )

  for (const outcome of evaluations) {
    if (outcome.status === 'fulfilled' && outcome.value !== null) {
      results.push(outcome.value)
    } else if (outcome.status === 'rejected') {
      logError('diagnosis-advisor', 'Rule evaluation rejected unexpectedly', { reason: outcome.reason })
    }
  }

  // Sort by severity: critical first, then warning, then info
  results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const summary: DiagnosisSummary = {
    results,
    analyzedAt: Date.now()
  }

  cachedSummary = summary
  cachedAt = Date.now()

  logInfo('diagnosis-advisor', 'Diagnosis completed', { resultCount: results.length })
  return summary
}
