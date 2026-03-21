import si from 'systeminformation'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { platform } from 'os'
import type { SystemStats, CpuInfo, MemoryInfo, GpuInfo, DriveInfo } from '@shared/types'

const execFileAsync = promisify(execFile)

export async function getSystemStats(): Promise<SystemStats> {
  const [cpuLoad, cpuInfo, mem, gpu, disks] = await Promise.all([
    si.currentLoad(),
    si.cpu(),
    si.mem(),
    si.graphics(),
    si.fsSize()
  ])

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
  } catch {
    // ignore
  }

  // macOS: mem.used にはファイルキャッシュ(inactive)が含まれ常に高い値になる
  // 実際のメモリ圧迫度 = (total - available) / total
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
  const gpuInfo: GpuInfo = {
    available: gpu.controllers.length > 0 && !!primaryGpu?.model,
    model: primaryGpu?.model ?? null,
    usage: primaryGpu?.utilizationGpu ?? null,
    memoryTotal: primaryGpu?.memoryTotal ? primaryGpu.memoryTotal * 1024 * 1024 : null,
    memoryUsed: primaryGpu?.memoryUsed ? primaryGpu.memoryUsed * 1024 * 1024 : null,
    temperature: primaryGpu?.temperatureGpu ?? null
  }

  // macOS APFS: purgeable space 계산
  const apfsInfo = platform() === 'darwin' ? await getApfsContainerInfo() : null

  const drives: DriveInfo[] = disks.map((d) => {
    let purgeable: number | null = null
    let realUsage: number | null = null

    if (apfsInfo && d.mount === '/') {
      // purgeable = 컨테이너 전체 사용량에서 df가 보여주는 사용량을 뺀 값
      // 즉, OS가 필요 시 자동 반환 가능한 공간 (스냅샷, iCloud 캐시 등)
      const containerUsed = apfsInfo.size - apfsInfo.free
      purgeable = containerUsed - d.used
      if (purgeable < 0) purgeable = 0

      // 실제 사용률 = purgeable 제외
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

  return {
    cpu,
    memory,
    gpu: gpuInfo,
    disk: { drives },
    timestamp: Date.now()
  }
}

// macOS APFS 컨테이너 정보 가져오기
// diskutil info -plist / → APFSContainerSize, APFSContainerFree
async function getApfsContainerInfo(): Promise<{ size: number; free: number } | null> {
  try {
    const { stdout } = await execFileAsync('diskutil', ['info', '-plist', '/'])
    const sizeMatch = stdout.match(/<key>APFSContainerSize<\/key>\s*<integer>(\d+)<\/integer>/)
    const freeMatch = stdout.match(/<key>APFSContainerFree<\/key>\s*<integer>(\d+)<\/integer>/)
    if (sizeMatch && freeMatch) {
      return {
        size: parseInt(sizeMatch[1], 10),
        free: parseInt(freeMatch[1], 10)
      }
    }
  } catch {
    // not APFS or command failed
  }
  return null
}
