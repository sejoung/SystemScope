import { randomUUID } from 'node:crypto'
import type { DiagnosisCategory, DiagnosisResult, DiagnosisSeverity } from '@shared/types'
import { getSystemStats } from '@main/services/system/systemMonitor'
import { runQuickScan } from '@main/services/disk/quickScan'
import { formatBytes } from '@shared/utils/formatBytes'
import { getProjectMonitorSummary } from '@main/services/projectMonitor/projectMonitor'

export interface DiagnosisRule {
  category: DiagnosisCategory
  evaluate: () => Promise<DiagnosisResult | null>
}

export const workspaceDiagnosisRules: DiagnosisRule[] = [
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
