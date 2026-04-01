import * as os from 'node:os'
import { app, dialog } from 'electron'
import * as fsp from 'node:fs/promises'
import type { ReportOptions, DiagnosticReportData, DiagnosticReportSection, SaveReportOptions } from '@shared/types'
import { getSystemStats } from './systemMonitor'
import { getTopCpuProcesses, getTopMemoryProcesses } from './processMonitor'
import { getDiagnosisSummary } from './diagnosisAdvisor'
import { getActiveAlerts } from './alertManager'
import { getCleanupInbox } from './cleanupInbox'
import { listDockerImages, listDockerContainers, listDockerVolumes } from './dockerImages'
import { getTimelineData } from './metricsStore'
import { logInfo } from './logging'
import { formatBytes } from '@shared/utils/formatBytes'

export function maskSensitivePaths(text: string, homePath: string, username: string): string {
  let result = text
  if (homePath) {
    result = result.replaceAll(homePath, '~')
  }
  if (username) {
    result = result.replaceAll(username, '<user>')
  }
  return result
}

function maybeApplyMask(text: string, shouldMask: boolean): string {
  if (!shouldMask) return text
  return maskSensitivePaths(text, os.homedir(), os.userInfo().username)
}

export async function buildDiagnosticReport(options: ReportOptions): Promise<DiagnosticReportData> {
  const sections: DiagnosticReportSection[] = []
  const mask = options.maskSensitivePaths

  if (options.sections.systemSummary) {
    const stats = await getSystemStats()
    const content = [
      `CPU: ${stats.cpu.usage.toFixed(1)}% (${stats.cpu.model})`,
      `Memory: ${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)} (${stats.memory.usage.toFixed(1)}%)`,
      `Swap: ${formatBytes(stats.memory.swapUsed)} / ${formatBytes(stats.memory.swapTotal)}`,
      ...stats.disk.drives.map((d) =>
        `Disk ${maybeApplyMask(d.mount, mask)}: ${formatBytes(d.used)} / ${formatBytes(d.size)} (${d.usage.toFixed(1)}%)`
      ),
      `Network: ↓${formatBytes(stats.network.downloadBytesPerSecond ?? 0)}/s ↑${formatBytes(stats.network.uploadBytesPerSecond ?? 0)}/s`,
    ].join('\n')
    sections.push({ key: 'systemSummary', title: 'System Summary', content, data: stats })
  }

  if (options.sections.recentHistory) {
    const timeline = await getTimelineData('24h')
    const points = timeline.points.slice(-12)
    const content = points.map((p) =>
      `${new Date(p.ts).toLocaleString()} — CPU: ${p.cpu.toFixed(1)}% | Mem: ${p.memory.toFixed(1)}%`
    ).join('\n')
    sections.push({ key: 'recentHistory', title: 'Recent History (last 12 points)', content, data: points })
  }

  if (options.sections.activeAlerts) {
    const alerts = getActiveAlerts()
    const content = alerts.length === 0
      ? 'No active alerts.'
      : alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.type}: ${a.message}`).join('\n')
    sections.push({ key: 'activeAlerts', title: 'Active Alerts', content, data: alerts })
  }

  if (options.sections.topProcesses) {
    const cpuTop = await getTopCpuProcesses(10)
    const memTop = await getTopMemoryProcesses(10)
    const lines = [
      '### Top CPU',
      ...cpuTop.map((p) => `${maybeApplyMask(p.name, mask)} (PID ${p.pid}): ${p.cpu.toFixed(1)}% CPU`),
      '',
      '### Top Memory',
      ...memTop.map((p) => `${maybeApplyMask(p.name, mask)} (PID ${p.pid}): ${formatBytes(p.memoryBytes)} (${p.memory.toFixed(1)}%)`),
    ]
    sections.push({ key: 'topProcesses', title: 'Top Processes', content: lines.join('\n'), data: { cpuTop, memTop } })
  }

  if (options.sections.diskCleanup) {
    const inbox = await getCleanupInbox()
    const content = inbox.items.length === 0
      ? 'No cleanup candidates.'
      : [
          `Total reclaimable: ${formatBytes(inbox.totalReclaimable)}`,
          '',
          ...inbox.items.slice(0, 20).map((item) =>
            `[${item.safetyLevel}] ${maybeApplyMask(item.path, mask)} — ${formatBytes(item.size)}`
          ),
        ].join('\n')
    sections.push({ key: 'diskCleanup', title: 'Disk Cleanup Candidates', content, data: inbox })
  }

  if (options.sections.dockerReclaim) {
    try {
      const images = await listDockerImages()
      const containers = await listDockerContainers()
      const volumes = await listDockerVolumes()
      const imagesTotalSize = images.images.reduce((sum, img) => sum + img.sizeBytes, 0)
      const content = [
        `Images: ${images.images.length} (${formatBytes(imagesTotalSize)})`,
        `Containers: ${containers.containers.length}`,
        `Volumes: ${volumes.volumes.length}`,
      ].join('\n')
      sections.push({ key: 'dockerReclaim', title: 'Docker Resources', content, data: { images, containers, volumes } })
    } catch {
      sections.push({ key: 'dockerReclaim', title: 'Docker Resources', content: 'Docker not available.', data: null })
    }
  }

  if (options.sections.diagnosis) {
    const summary = await getDiagnosisSummary()
    const content = summary.results.length === 0
      ? 'No issues detected.'
      : summary.results.map((r) => {
          const evidenceStr = r.evidence.map((e) => `  - ${e.label}: ${e.value}${e.threshold ? ` (threshold: ${e.threshold})` : ''}`).join('\n')
          return `[${r.severity.toUpperCase()}] ${r.title}\n${r.description}\n${evidenceStr}`
        }).join('\n\n')
    sections.push({ key: 'diagnosis', title: 'Diagnosis', content, data: summary })
  }

  logInfo('report-builder', 'Report built', { sectionCount: sections.length })

  return {
    generatedAt: Date.now(),
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    sections,
  }
}

export function renderReportAsMarkdown(report: DiagnosticReportData): string {
  const lines: string[] = [
    '# SystemScope Diagnostic Report',
    '',
    `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    `App Version: ${report.appVersion}`,
    `Platform: ${report.platform} (${report.arch})`,
    '',
    '---',
    '',
  ]

  for (const section of report.sections) {
    lines.push(`## ${section.title}`, '', section.content, '', '---', '')
  }

  return lines.join('\n')
}

export async function saveDiagnosticReport(options: SaveReportOptions): Promise<string> {
  const defaultName = `systemscope-report-${new Date().toISOString().slice(0, 10)}`
  const ext = options.format === 'markdown' ? 'md' : 'json'

  const result = await dialog.showSaveDialog({
    defaultPath: `${defaultName}.${ext}`,
    filters: options.format === 'markdown'
      ? [{ name: 'Markdown', extensions: ['md'] }]
      : [{ name: 'JSON', extensions: ['json'] }],
  })

  if (result.canceled || !result.filePath) {
    throw new Error('Save cancelled')
  }

  const content = options.format === 'markdown'
    ? renderReportAsMarkdown(options.report)
    : JSON.stringify(options.report, null, 2)

  await fsp.writeFile(result.filePath, content, 'utf-8')
  logInfo('report-builder', 'Report saved', { filePath: result.filePath, format: options.format })

  return result.filePath
}
