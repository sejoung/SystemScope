import si from 'systeminformation'
import { platform } from 'node:os'
import type { SystemStats, CpuInfo, MemoryInfo, DriveInfo, DiskIoInfo, NetworkInfo } from '@shared/types'
import { logDebug, logWarn } from '@main/services/core/logging'
import { isExternalCommandError, runExternalCommand } from '@main/services/core/externalCommand'
import { getCachedGpuInfo } from './gpuMonitor'
let hasLoggedApfsContainerFallback = false

let lastDiskStats: DriveInfo[] | null = null
let lastDiskFetchTime = 0
const DISK_CACHE_TTL = 30 * 1000 // 30초 캐시
let lastSystemStats: SystemStats | null = null
let lastSystemStatsFetchTime = 0
let pendingSystemStats: Promise<SystemStats> | null = null
const SYSTEM_STATS_CACHE_TTL = 1000

export async function getSystemStats(): Promise<SystemStats> {
  const now = Date.now()
  if (lastSystemStats && now - lastSystemStatsFetchTime < SYSTEM_STATS_CACHE_TTL) {
    return lastSystemStats
  }
  if (pendingSystemStats) {
    return pendingSystemStats
  }

  pendingSystemStats = (async () => {
    const [cpuLoad, cpuInfo, mem, gpuInfo, diskIo, network] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
      si.mem(),
      getCachedGpuInfo(),
      getDiskIoInfo(),
      getNetworkInfo()
    ])

    // 디스크 정보: 캐시가 유효하면 캐시 사용, 아니면 새로 가져옴
    const statsNow = Date.now()
    let drives: DriveInfo[]

    if (lastDiskStats && statsNow - lastDiskFetchTime < DISK_CACHE_TTL) {
      drives = lastDiskStats
    } else {
      try {
        const disks = await si.fsSize()
        const apfsInfo = platform() === 'darwin' ? await getApfsContainerInfo() : null

        drives = disks.map((d) => {
          let purgeable: number | null = null
          let realUsage: number | null = null

          if (apfsInfo && d.mount === '/') {
            const containerUsed = apfsInfo.size - apfsInfo.free
            purgeable = containerUsed - d.used
            if (purgeable < 0) purgeable = 0
            const realUsed = d.used
            realUsage = Math.round((realUsed / apfsInfo.size) * 10000) / 100
          }

          return {
            fs: d.fs,
            type: d.type,
            size: apfsInfo && d.mount === '/' ? apfsInfo.size : d.size,
            used: d.used,
            available: apfsInfo && d.mount === '/' ? apfsInfo.free : d.available,
            usage: apfsInfo && d.mount === '/'
              ? Math.round(((apfsInfo.size - apfsInfo.free) / apfsInfo.size) * 10000) / 100
              : Math.round(d.use * 100) / 100,
            mount: d.mount,
            purgeable,
            realUsage
          }
        })
        lastDiskStats = drives
        lastDiskFetchTime = statsNow
      } catch (err) {
        logWarn('system-monitor', 'Failed to load disk information', { error: err })
        drives = lastDiskStats || []
      }
    }

    const cpu: CpuInfo = {
      usage: Math.round(cpuLoad.currentLoad * 100) / 100,
      cores: cpuLoad.cpus.map((c) => Math.round(c.load * 100) / 100),
      model: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
      speed: cpuInfo.speed
    }

    // macOS: mem.used에는 파일 캐시(inactive)가 포함되어 항상 높은 값을 보여줌
    // 실제 메모리 사용률 = (total - available) / total
    const cached = mem.used - mem.active
    const memory: MemoryInfo = {
      total: mem.total,
      used: mem.used,
      active: mem.active,
      available: mem.available,
      cached: cached > 0 ? cached : 0,
      usage: Math.round(((mem.total - mem.available) / mem.total) * 10000) / 100,
      swapTotal: mem.swaptotal,
      swapUsed: mem.swapused
    }

    const nextStats: SystemStats = {
      cpu,
      memory,
      gpu: gpuInfo,
      disk: {
        drives,
        io: diskIo
      },
      network,
      timestamp: Date.now()
    }

    lastSystemStats = nextStats
    lastSystemStatsFetchTime = Date.now()
    return nextStats
  })().finally(() => {
    pendingSystemStats = null
  })

  return pendingSystemStats
}

async function getWindowsDiskIoInfo(): Promise<DiskIoInfo> {
  const { stdout } = await runExternalCommand('powershell', [
    '-NoProfile',
    '-Command',
    "Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter \"Name='_Total'\" | Select-Object DiskReadsPerSec,DiskWritesPerSec,DiskTransfersPerSec,PercentDiskTime | ConvertTo-Json"
  ])

  const trimmed = stdout.trim()
  if (!trimmed) {
    return { readsPerSecond: null, writesPerSecond: null, totalPerSecond: null, busyPercent: null }
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(trimmed)
  } catch {
    logWarn('system-monitor', 'Failed to parse Windows disk I/O output', { stdout: trimmed.slice(0, 200) })
    return { readsPerSecond: null, writesPerSecond: null, totalPerSecond: null, busyPercent: null }
  }

  return {
    readsPerSecond: sanitizeRate(data.DiskReadsPerSec as number | null | undefined),
    writesPerSecond: sanitizeRate(data.DiskWritesPerSec as number | null | undefined),
    totalPerSecond: sanitizeRate(data.DiskTransfersPerSec as number | null | undefined),
    busyPercent: sanitizeRate(data.PercentDiskTime as number | null | undefined)
  }
}

async function getDiskIoInfo(): Promise<DiskIoInfo> {
  try {
    const stats = await si.disksIO()
    if (stats) {
      return {
        readsPerSecond: sanitizeRate(stats.rIO_sec),
        writesPerSecond: sanitizeRate(stats.wIO_sec),
        totalPerSecond: sanitizeRate(stats.tIO_sec),
        busyPercent: sanitizeRate(stats.tWaitPercent)
      }
    }
    if (platform() === 'win32') {
      return await getWindowsDiskIoInfo()
    }
    return {
      readsPerSecond: null,
      writesPerSecond: null,
      totalPerSecond: null,
      busyPercent: null
    }
  } catch (err) {
    logDebug('system-monitor', 'Disk I/O information is unavailable', { error: err })
    return {
      readsPerSecond: null,
      writesPerSecond: null,
      totalPerSecond: null,
      busyPercent: null
    }
  }
}

async function getNetworkInfo(): Promise<NetworkInfo> {
  try {
    const stats = await si.networkStats('*')
    const activeStats = stats.filter((item) => item.operstate === 'up')
    const source = activeStats.length > 0 ? activeStats : stats

    return {
      downloadBytesPerSecond: sanitizeRate(sumNumeric(source.map((item) => item.rx_sec))),
      uploadBytesPerSecond: sanitizeRate(sumNumeric(source.map((item) => item.tx_sec))),
      totalDownloadedBytes: sanitizeTotal(sumNumeric(source.map((item) => item.rx_bytes))),
      totalUploadedBytes: sanitizeTotal(sumNumeric(source.map((item) => item.tx_bytes))),
      interfaces: source.map((item) => item.iface).filter(Boolean)
    }
  } catch (err) {
    logDebug('system-monitor', 'Network information is unavailable', { error: err })
    return {
      downloadBytesPerSecond: null,
      uploadBytesPerSecond: null,
      totalDownloadedBytes: null,
      totalUploadedBytes: null,
      interfaces: []
    }
  }
}

function sanitizeRate(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.round(value * 100) / 100
}

function sanitizeTotal(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.round(value)
}

function sumNumeric(values: Array<number | null | undefined>): number | null {
  const numericValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (numericValues.length === 0) {
    return null
  }
  return numericValues.reduce((sum, value) => sum + value, 0)
}

function extractPlistInteger(xml: string, key: string): number | null {
  const pattern = new RegExp(`<key>${key}</key>\\s*<integer>(\\d+)</integer>`)
  const match = xml.match(pattern)
  return match ? Number(match[1]) : null
}

// macOS APFS 컨테이너 정보 가져오기
async function getApfsContainerInfo(): Promise<{ size: number; free: number } | null> {
  try {
    const { stdout: plistXml } = await runExternalCommand('diskutil', ['info', '-plist', '/'])

    const size = extractPlistInteger(plistXml, 'APFSContainerSize')
    const free = extractPlistInteger(plistXml, 'APFSContainerFree')

    if (typeof size === 'number' && typeof free === 'number') {
      return { size, free }
    }

    logWarn('system-monitor', 'diskutil JSON data does not contain valid APFS size information', { plistXml })
  } catch (err) {
    if (!hasLoggedApfsContainerFallback) {
      hasLoggedApfsContainerFallback = true
      logDebug('system-monitor', 'APFS container information unavailable, falling back to fsSize data', {
        reason: isExternalCommandError(err) ? err.kind : 'execution_failed',
        error: err
      })
    }
  }
  return null
}
