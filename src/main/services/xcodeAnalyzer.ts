import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir } from 'node:os'
import type { ToolIntegrationResult, ReclaimableItem, ToolSummaryItem } from '@shared/types'
import { runExternalCommand, isExternalCommandError } from './externalCommand'
import { getDirSizeEstimate } from '../utils/getDirSize'
import { logInfo, logDebug, logError } from './logging'
import { formatBytes } from '@shared/utils/formatBytes'

const DERIVED_DATA_PATH = path.join(homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData')
const ARCHIVES_PATH = path.join(homedir(), 'Library', 'Developer', 'Xcode', 'Archives')
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

interface SimulatorDevice {
  name: string
  udid: string
  state: string
  isAvailable: boolean
  dataPath?: string
}

interface SimctlDevices {
  devices: Record<string, SimulatorDevice[]>
}

export async function scanXcode(): Promise<ToolIntegrationResult> {
  const derivedDataExists = await dirExists(DERIVED_DATA_PATH)
  const archivesExists = await dirExists(ARCHIVES_PATH)

  if (!derivedDataExists && !archivesExists) {
    return { tool: 'xcode', status: 'not_installed', message: 'Xcode development data not found.', summary: [], reclaimable: [], lastScannedAt: Date.now() }
  }

  try {
    const [derivedDataResult, archivesResult, simulatorResult] = await Promise.all([
      scanDerivedData(), scanArchives(), scanSimulators()
    ])

    const summary: ToolSummaryItem[] = [
      { key: 'derivedDataSize', label: 'DerivedData', value: formatBytes(derivedDataResult.totalSize) },
      { key: 'derivedDataProjects', label: 'Projects', value: String(derivedDataResult.projectCount) },
      { key: 'archivesSize', label: 'Archives', value: formatBytes(archivesResult.totalSize) },
      { key: 'simulators', label: 'Simulators', value: String(simulatorResult.totalCount) },
      { key: 'unavailableSimulators', label: 'Unavailable Sims', value: String(simulatorResult.unavailableCount) }
    ]

    const reclaimable: ReclaimableItem[] = [
      ...derivedDataResult.reclaimable, ...archivesResult.reclaimable, ...simulatorResult.reclaimable
    ]

    logInfo('xcode-analyzer', 'Xcode scan completed', {
      derivedDataSize: derivedDataResult.totalSize, archivesSize: archivesResult.totalSize,
      simulatorCount: simulatorResult.totalCount, unavailableCount: simulatorResult.unavailableCount,
      reclaimableCount: reclaimable.length
    })

    return { tool: 'xcode', status: 'ready', message: null, summary, reclaimable, lastScannedAt: Date.now() }
  } catch (err) {
    logError('xcode-analyzer', 'Xcode scan failed', { error: err })
    return { tool: 'xcode', status: 'error', message: 'Failed to scan Xcode data.', summary: [], reclaimable: [], lastScannedAt: Date.now() }
  }
}

async function scanDerivedData(): Promise<{ totalSize: number; projectCount: number; reclaimable: ReclaimableItem[] }> {
  const reclaimable: ReclaimableItem[] = []
  let totalSize = 0
  let projectCount = 0
  try {
    const entries = await fs.readdir(DERIVED_DATA_PATH, { withFileTypes: true })
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    projectCount = dirs.length
    for (const dir of dirs) {
      const fullPath = path.join(DERIVED_DATA_PATH, dir.name)
      try {
        const size = await getDirSizeEstimate(fullPath, 4)
        totalSize += size
        const projectName = dir.name.replace(/-[a-z]{24,}$/i, '') || dir.name
        reclaimable.push({ id: `xcode-dd-${reclaimable.length}`, tool: 'xcode', path: fullPath, label: `DerivedData: ${projectName}`, size, category: 'derived_data', safetyLevel: 'safe' })
      } catch {
        logDebug('xcode-analyzer', 'Skipping inaccessible DerivedData entry', { path: fullPath })
      }
    }
  } catch { /* DerivedData not accessible */ }
  return { totalSize, projectCount, reclaimable }
}

async function scanArchives(): Promise<{ totalSize: number; reclaimable: ReclaimableItem[] }> {
  const reclaimable: ReclaimableItem[] = []
  let totalSize = 0
  const now = Date.now()
  try {
    const dateDirs = await fs.readdir(ARCHIVES_PATH, { withFileTypes: true })
    for (const dateDir of dateDirs) {
      if (!dateDir.isDirectory()) continue
      const dateDirPath = path.join(ARCHIVES_PATH, dateDir.name)
      try {
        const archives = await fs.readdir(dateDirPath, { withFileTypes: true })
        for (const archive of archives) {
          if (!archive.isDirectory() || !archive.name.endsWith('.xcarchive')) continue
          const archivePath = path.join(dateDirPath, archive.name)
          try {
            const stat = await fs.stat(archivePath)
            const size = await getDirSizeEstimate(archivePath, 4)
            totalSize += size
            const isOld = (now - stat.mtimeMs) > NINETY_DAYS_MS
            const archiveName = archive.name.replace('.xcarchive', '')
            reclaimable.push({ id: `xcode-archive-${reclaimable.length}`, tool: 'xcode', path: archivePath, label: `Archive: ${archiveName}`, size, category: 'archive', safetyLevel: isOld ? 'caution' : 'risky' })
          } catch {
            logDebug('xcode-analyzer', 'Skipping inaccessible archive', { path: archivePath })
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* Archives not accessible */ }
  return { totalSize, reclaimable }
}

async function scanSimulators(): Promise<{ totalCount: number; unavailableCount: number; reclaimable: ReclaimableItem[] }> {
  const reclaimable: ReclaimableItem[] = []
  let totalCount = 0
  let unavailableCount = 0
  try {
    const { stdout } = await runExternalCommand('xcrun', ['simctl', 'list', 'devices', '-j'], { timeout: 30000 })
    const parsed = JSON.parse(stdout) as SimctlDevices
    for (const [runtime, devices] of Object.entries(parsed.devices)) {
      for (const device of devices) {
        totalCount++
        if (!device.isAvailable) {
          unavailableCount++
          let size = 0
          if (device.dataPath) {
            try { size = await getDirSizeEstimate(device.dataPath, 3) } catch { /* skip */ }
          }
          const runtimeLabel = runtime.replace('com.apple.CoreSimulator.SimRuntime.', '').replace(/-/g, ' ')
          reclaimable.push({ id: `xcode-sim-${device.udid}`, tool: 'xcode', path: device.dataPath ?? '', label: `Simulator: ${device.name} (${runtimeLabel})`, size, category: 'simulator', safetyLevel: 'safe' })
        }
      }
    }
  } catch (err) {
    if (isExternalCommandError(err) && err.kind === 'command_not_found') {
      logDebug('xcode-analyzer', 'xcrun not found, skipping simulator scan')
    } else {
      logDebug('xcode-analyzer', 'Failed to list simulators', { error: err })
    }
  }
  return { totalCount, unavailableCount, reclaimable }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch { return false }
}
