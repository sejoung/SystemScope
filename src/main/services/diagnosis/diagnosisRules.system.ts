import { randomUUID } from 'node:crypto'
import type { DiagnosisCategory, DiagnosisResult, DiagnosisSeverity } from '@shared/types'
import { getSystemStats } from '@main/services/system/systemMonitor'
import { getTopCpuProcesses } from '@main/services/process/processMonitor'
import { listDockerContainers, listDockerImages, listDockerVolumes } from '@main/services/docker/dockerImages'
import { formatBytes } from '@shared/utils/formatBytes'

export interface DiagnosisRule {
  category: DiagnosisCategory
  evaluate: () => Promise<DiagnosisResult | null>
}

export const systemDiagnosisRules: DiagnosisRule[] = [
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

]
