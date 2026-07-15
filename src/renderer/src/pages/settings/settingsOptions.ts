import type { AlertThresholds } from '@shared/types'

export const SNAPSHOT_OPTIONS = [
  { value: 15, labelKey: 'settings.snapshots.option_15m' },
  { value: 30, labelKey: 'settings.snapshots.option_30m' },
  { value: 60, labelKey: 'settings.snapshots.option_1h' },
  { value: 120, labelKey: 'settings.snapshots.option_2h' },
  { value: 360, labelKey: 'settings.snapshots.option_6h' },
] as const

export const THRESHOLD_PRESETS = [
  {
    labelKey: 'settings.alerts.preset.conservative' as const,
    thresholds: {
      cpuWarning: 60, cpuCritical: 80,
      diskWarning: 70, diskCritical: 85,
      memoryWarning: 60, memoryCritical: 80,
      gpuMemoryWarning: 60, gpuMemoryCritical: 80,
    } satisfies AlertThresholds,
  },
  {
    labelKey: 'settings.alerts.preset.balanced' as const,
    thresholds: {
      cpuWarning: 75, cpuCritical: 85,
      diskWarning: 80, diskCritical: 90,
      memoryWarning: 75, memoryCritical: 85,
      gpuMemoryWarning: 75, gpuMemoryCritical: 85,
    } satisfies AlertThresholds,
  },
  {
    labelKey: 'settings.alerts.preset.aggressive' as const,
    thresholds: {
      cpuWarning: 85, cpuCritical: 95,
      diskWarning: 85, diskCritical: 95,
      memoryWarning: 85, memoryCritical: 95,
      gpuMemoryWarning: 85, gpuMemoryCritical: 95,
    } satisfies AlertThresholds,
  },
]
