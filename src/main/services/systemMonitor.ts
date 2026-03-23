import si from 'systeminformation'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { platform } from 'os'
import type { SystemStats, CpuInfo, MemoryInfo, GpuInfo, DriveInfo } from '@shared/types'
import { logDebug, logWarn } from './logging'

const execFileAsync = promisify(execFile)
let hasLoggedApfsContainerFallback = false

let lastDiskStats: DriveInfo[] | null = null
let lastDiskFetchTime = 0
const DISK_CACHE_TTL = 30 * 1000 // 30초 캐시

export async function getSystemStats(): Promise<SystemStats> {
  const [cpuLoad, cpuInfo, mem, gpu] = await Promise.all([
    si.currentLoad(),
    si.cpu(),
    si.mem(),
    si.graphics()
  ])

  // 디스크 정보: 캐시가 유효하면 캐시 사용, 아니면 새로 가져옴
  const now = Date.now()
  let drives: DriveInfo[]

  if (lastDiskStats && now - lastDiskFetchTime < DISK_CACHE_TTL) {
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
      lastDiskFetchTime = now
    } catch (err) {
      logWarn('system-monitor', 'Failed to load disk information', { error: err })
      drives = lastDiskStats || []
    }
  }

  const cpu: CpuInfo = {
    usage: Math.round(cpuLoad.currentLoad * 100) / 100,
    cores: cpuLoad.cpus.map((c) => Math.round(c.load * 100) / 100),
    temperature: null,
    model: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
    speed: cpuInfo.speed
  }

  try {
    const temp = await si.cpuTemperature()
    cpu.temperature = temp.main !== null ? Math.round(temp.main * 10) / 10 : null
  } catch (err) {
    logDebug('system-monitor', 'CPU temperature information is unavailable', { error: err })
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

  const primaryGpu = gpu.controllers[0]
  const gpuInfo: GpuInfo = primaryGpu && primaryGpu.model
    ? {
        available: true,
        model: primaryGpu.model,
        usage: primaryGpu.utilizationGpu ?? null,
        memoryTotal: primaryGpu.memoryTotal ? primaryGpu.memoryTotal * 1024 * 1024 : null,
        memoryUsed: primaryGpu.memoryUsed ? primaryGpu.memoryUsed * 1024 * 1024 : null,
        temperature: primaryGpu.temperatureGpu ?? null
      }
    : {
        available: false,
        model: null,
        usage: null,
        memoryTotal: null,
        memoryUsed: null,
        temperature: null
      }

  return {
    cpu,
    memory,
    gpu: gpuInfo,
    disk: { drives },
    timestamp: Date.now()
  }
}

// macOS APFS 컨테이너 정보 가져오기
// diskutil info -plist / 결과를 JSON으로 변환하여 안전하게 파싱
async function getApfsContainerInfo(): Promise<{ size: number; free: number } | null> {
  try {
    // diskutil의 XML 출력을 plutil을 이용해 JSON으로 변환
    const { stdout } = await execFileAsync('bash', [
      '-c',
      'diskutil info -plist / | plutil -convert json -o - -- -'
    ])

    const data = JSON.parse(stdout)
    const size = data.APFSContainerSize
    const free = data.APFSContainerFree

    if (typeof size === 'number' && typeof free === 'number') {
      return { size, free }
    }

    logWarn('system-monitor', 'diskutil JSON data does not contain valid APFS size information', { data })
  } catch (err) {
    if (!hasLoggedApfsContainerFallback) {
      hasLoggedApfsContainerFallback = true
      logDebug('system-monitor', 'APFS container information unavailable, falling back to fsSize data', { error: err })
    }
  }
  return null
}
