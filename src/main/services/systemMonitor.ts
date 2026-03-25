import si from 'systeminformation'
import { platform } from 'os'
import type { SystemStats, CpuInfo, MemoryInfo, GpuInfo, DriveInfo } from '@shared/types'
import { logDebug, logInfo, logWarn } from './logging'
import { isExternalCommandError, runExternalCommand } from './externalCommand'
let hasLoggedApfsContainerFallback = false
let hasLoggedWindowsGpuDiagnostics = false
let lastGpuStats: GpuInfo | null = null
let lastGpuFetchTime = 0
let pendingGpuStats: Promise<GpuInfo> | null = null
const GPU_CACHE_TTL = 5 * 1000
let lastCpuTemperature: number | null = null
let lastCpuTemperatureFetchTime = 0
let pendingCpuTemperature: Promise<number | null> | null = null
const CPU_TEMPERATURE_CACHE_TTL = 5 * 1000

let lastDiskStats: DriveInfo[] | null = null
let lastDiskFetchTime = 0
const DISK_CACHE_TTL = 30 * 1000 // 30초 캐시

type GraphicsController = Awaited<ReturnType<typeof si.graphics>>['controllers'][number]

export async function getSystemStats(): Promise<SystemStats> {
  const [cpuLoad, cpuInfo, mem, gpuInfo] = await Promise.all([
    si.currentLoad(),
    si.cpu(),
    si.mem(),
    getCachedGpuInfo()
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

  cpu.temperature = await getCachedCpuTemperature()

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

  return {
    cpu,
    memory,
    gpu: gpuInfo,
    disk: { drives },
    timestamp: Date.now()
  }
}

async function getCachedGpuInfo(): Promise<GpuInfo> {
  const now = Date.now()
  if (lastGpuStats && now - lastGpuFetchTime < GPU_CACHE_TTL) {
    return lastGpuStats
  }
  if (pendingGpuStats) {
    return pendingGpuStats
  }

  pendingGpuStats = si.graphics()
    .then((gpu) => {
      const primaryGpu = pickPrimaryGpuController(gpu.controllers)
      const hasUsageData = primaryGpu ? controllerHasUsageData(primaryGpu) : false

      logWindowsGpuDiagnostics(gpu.controllers, primaryGpu)

      const nextGpuInfo: GpuInfo = primaryGpu && primaryGpu.model
        ? {
            available: true,
            model: primaryGpu.model,
            usage: primaryGpu.utilizationGpu ?? null,
            memoryTotal: primaryGpu.memoryTotal ? primaryGpu.memoryTotal * 1024 * 1024 : null,
            memoryUsed: primaryGpu.memoryUsed ? primaryGpu.memoryUsed * 1024 * 1024 : null,
            temperature: primaryGpu.temperatureGpu ?? null,
            unavailableReason: hasUsageData ? null : detectGpuUnavailableReason(primaryGpu)
          }
        : {
            available: false,
            model: null,
            usage: null,
            memoryTotal: null,
            memoryUsed: null,
            temperature: null,
            unavailableReason: null
          }

      lastGpuStats = nextGpuInfo
      lastGpuFetchTime = Date.now()
      return nextGpuInfo
    })
    .finally(() => {
      pendingGpuStats = null
    })

  return pendingGpuStats
}

async function getCachedCpuTemperature(): Promise<number | null> {
  const now = Date.now()
  if (now - lastCpuTemperatureFetchTime < CPU_TEMPERATURE_CACHE_TTL) {
    return lastCpuTemperature
  }
  if (pendingCpuTemperature) {
    return pendingCpuTemperature
  }

  pendingCpuTemperature = si.cpuTemperature()
    .then((temp) => {
      lastCpuTemperature = temp.main !== null ? Math.round(temp.main * 10) / 10 : null
      lastCpuTemperatureFetchTime = Date.now()
      return lastCpuTemperature
    })
    .catch((err) => {
      logDebug('system-monitor', 'CPU temperature information is unavailable', { error: err })
      lastCpuTemperatureFetchTime = Date.now()
      return lastCpuTemperature
    })
    .finally(() => {
      pendingCpuTemperature = null
    })

  return pendingCpuTemperature
}

function logWindowsGpuDiagnostics(
  controllers: GraphicsController[],
  primaryGpu: GraphicsController | null
): void {
  if (platform() !== 'win32' || hasLoggedWindowsGpuDiagnostics) return

  hasLoggedWindowsGpuDiagnostics = true
  logInfo('system-monitor', 'Windows GPU controller diagnostics', {
    controllerCount: controllers.length,
    selectedModel: primaryGpu?.model ?? null,
    selectedHasUsageData: primaryGpu ? controllerHasUsageData(primaryGpu) : false,
    selectedIsVirtualAdapter: primaryGpu ? isVirtualGpuModel(primaryGpu.model) : false,
    controllers: controllers.map((controller) => ({
      model: controller.model ?? null,
      vendor: controller.vendor ?? null,
      bus: controller.bus ?? null,
      vram: controller.vram ?? null,
      utilizationGpu: controller.utilizationGpu ?? null,
      memoryTotal: controller.memoryTotal ?? null,
      memoryUsed: controller.memoryUsed ?? null
    }))
  })
}

function pickPrimaryGpuController(controllers: GraphicsController[]): GraphicsController | null {
  const candidates = controllers.filter((controller) => Boolean(controller.model))
  if (candidates.length === 0) return null

  return candidates
    .slice()
    .sort((a, b) => scoreGpuController(b) - scoreGpuController(a))[0]
}

function scoreGpuController(controller: GraphicsController): number {
  let score = 0

  if (controllerHasUsageData(controller)) score += 100
  if (!isVirtualGpuModel(controller.model)) score += 50
  if (controller.vram) score += 10
  if (controller.memoryTotal || controller.memoryUsed) score += 10

  return score
}

function controllerHasUsageData(controller: GraphicsController): boolean {
  return controller.utilizationGpu !== null || controller.memoryTotal !== null || controller.memoryUsed !== null
}

function detectGpuUnavailableReason(controller: GraphicsController): GpuInfo['unavailableReason'] {
  if (platform() === 'darwin' && /apple/i.test(controller.model)) {
    return 'apple_silicon'
  }

  if (isVirtualGpuModel(controller.model)) {
    return 'virtual_adapter'
  }

  return 'metrics_unavailable'
}

function isVirtualGpuModel(model: string): boolean {
  return /(microsoft remote display adapter|microsoft basic display adapter|microsoft basic render driver|parallels display adapter|vmware svga|virtualbox graphics adapter|virtio gpu)/i.test(model)
}

// macOS APFS 컨테이너 정보 가져오기
// diskutil info -plist / 결과를 JSON으로 변환하여 안전하게 파싱
async function getApfsContainerInfo(): Promise<{ size: number; free: number } | null> {
  try {
    // diskutil의 XML 출력을 plutil을 이용해 JSON으로 변환
    const { stdout } = await runExternalCommand('bash', [
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
      logDebug('system-monitor', 'APFS container information unavailable, falling back to fsSize data', {
        reason: isExternalCommandError(err) ? err.kind : 'execution_failed',
        error: err
      })
    }
  }
  return null
}
