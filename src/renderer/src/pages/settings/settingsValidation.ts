import type { AlertThresholds } from '@shared/types'

interface ThresholdLabels {
  cpu: string
  disk: string
  memory: string
  gpuMemory: string
}

export function findInvalidThresholdLabels(
  thresholds: AlertThresholds,
  labels: ThresholdLabels,
): string[] {
  const groups = [
    [labels.cpu, thresholds.cpuWarning, thresholds.cpuCritical],
    [labels.disk, thresholds.diskWarning, thresholds.diskCritical],
    [labels.memory, thresholds.memoryWarning, thresholds.memoryCritical],
    [labels.gpuMemory, thresholds.gpuMemoryWarning, thresholds.gpuMemoryCritical],
  ] as const

  return groups
    .filter(([, warning, critical]) => warning >= critical)
    .map(([label]) => label)
}
