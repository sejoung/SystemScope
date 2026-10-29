import si from 'systeminformation'
import { platform } from 'node:os'
import type { GpuInfo } from '@shared/types'
import { logDebug, logInfo } from '@main/services/core/logging'

type GraphicsController = Awaited<ReturnType<typeof si.graphics>>['controllers'][number]
const GPU_CACHE_TTL = 5 * 1000
const GPU_FETCH_TIMEOUT_MS = 5_000
let hasLoggedWindowsGpuDiagnostics = false
let lastGpuStats: GpuInfo | null = null
let lastGpuFetchTime = 0
let pendingGpuStats: Promise<GpuInfo> | null = null

export async function getCachedGpuInfo(): Promise<GpuInfo> {
  const now = Date.now()
  if (lastGpuStats && now - lastGpuFetchTime < GPU_CACHE_TTL) return lastGpuStats
  if (pendingGpuStats) return pendingGpuStats
  let timer: ReturnType<typeof setTimeout> | undefined
  pendingGpuStats = Promise.race([
    si.graphics(),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('GPU collection timed out')), GPU_FETCH_TIMEOUT_MS)
    }),
  ]).then((gpu) => {
    const primaryGpu = pickPrimaryGpuController(gpu.controllers)
    const hasUsageData = primaryGpu ? controllerHasUsageData(primaryGpu) : false
    logWindowsGpuDiagnostics(gpu.controllers, primaryGpu)
    const nextGpuInfo: GpuInfo = primaryGpu && primaryGpu.model ? {
      available: true,
      model: primaryGpu.model,
      usage: validMetric(primaryGpu.utilizationGpu),
      memoryTotal: validMetric(primaryGpu.memoryTotal) === null ? null : primaryGpu.memoryTotal! * 1024 * 1024,
      memoryUsed: validMetric(primaryGpu.memoryUsed) === null ? null : primaryGpu.memoryUsed! * 1024 * 1024,
      temperature: validMetric(primaryGpu.temperatureGpu),
      unavailableReason: hasUsageData ? null : detectGpuUnavailableReason(primaryGpu)
    } : { available: false, model: null, usage: null, memoryTotal: null, memoryUsed: null, temperature: null, unavailableReason: null }
    lastGpuStats = nextGpuInfo
    lastGpuFetchTime = Date.now()
    return nextGpuInfo
  }).catch((error) => {
    logDebug('system-monitor', 'GPU information is unavailable', { error })
    const unavailable: GpuInfo = {
      available: false, model: null, usage: null, memoryTotal: null,
      memoryUsed: null, temperature: null, unavailableReason: 'metrics_unavailable',
    }
    lastGpuStats = unavailable
    lastGpuFetchTime = Date.now()
    return unavailable
  }).finally(() => {
    clearTimeout(timer)
    pendingGpuStats = null
  })
  return pendingGpuStats
}

function logWindowsGpuDiagnostics(controllers: GraphicsController[], primaryGpu: GraphicsController | null): void {
  if (platform() !== 'win32' || hasLoggedWindowsGpuDiagnostics) return
  hasLoggedWindowsGpuDiagnostics = true
  logInfo('system-monitor', 'Windows GPU controller diagnostics', {
    controllerCount: controllers.length,
    selectedModel: primaryGpu?.model ?? null,
    selectedHasUsageData: primaryGpu ? controllerHasUsageData(primaryGpu) : false,
    selectedIsVirtualAdapter: primaryGpu ? isVirtualGpuModel(primaryGpu.model) : false,
    controllers: controllers.map((controller) => ({ model: controller.model ?? null, vendor: controller.vendor ?? null, bus: controller.bus ?? null, vram: controller.vram ?? null, utilizationGpu: controller.utilizationGpu ?? null, memoryTotal: controller.memoryTotal ?? null, memoryUsed: controller.memoryUsed ?? null }))
  })
}

function pickPrimaryGpuController(controllers: GraphicsController[]): GraphicsController | null {
  const candidates = controllers.filter((controller) => Boolean(controller.model))
  return candidates.length === 0 ? null : candidates.slice().sort((a, b) => scoreGpuController(b) - scoreGpuController(a))[0]
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
  return [controller.utilizationGpu, controller.memoryTotal, controller.memoryUsed]
    .some((value) => validMetric(value) !== null)
}

function validMetric(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function detectGpuUnavailableReason(controller: GraphicsController): GpuInfo['unavailableReason'] {
  if (platform() === 'darwin' && /apple/i.test(controller.model)) return 'apple_silicon'
  if (isVirtualGpuModel(controller.model)) return 'virtual_adapter'
  return 'metrics_unavailable'
}

function isVirtualGpuModel(model: string): boolean {
  return /(microsoft remote display adapter|microsoft basic display adapter|microsoft basic render driver|parallels display adapter|vmware svga|virtualbox graphics adapter|virtio gpu)/i.test(model)
}
