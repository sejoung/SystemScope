import type { AlertThresholds } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'

export const SNAPSHOT_INTERVAL_OPTIONS = [15, 30, 60, 120, 360] as const
export type SnapshotIntervalMin = (typeof SNAPSHOT_INTERVAL_OPTIONS)[number]

export interface AppSettings {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
  snapshotIntervalMin: SnapshotIntervalMin
}

export const DEFAULT_SETTINGS: AppSettings = {
  thresholds: DEFAULT_THRESHOLDS,
  theme: 'dark',
  snapshotIntervalMin: 60
}

function isSnapshotInterval(value: unknown): value is SnapshotIntervalMin {
  return typeof value === 'number' && SNAPSHOT_INTERVAL_OPTIONS.includes(value as SnapshotIntervalMin)
}

const THRESHOLD_KEYS = [
  'diskWarning',
  'diskCritical',
  'memoryWarning',
  'memoryCritical',
  'gpuMemoryWarning',
  'gpuMemoryCritical'
] as const satisfies readonly (keyof AlertThresholds)[]

function isTheme(value: unknown): value is AppSettings['theme'] {
  return value === 'dark' || value === 'light'
}

function isAlertThresholds(value: unknown): value is AlertThresholds {
  if (!value || typeof value !== 'object') return false

  for (const key of THRESHOLD_KEYS) {
    const threshold = (value as Record<string, unknown>)[key]
    if (typeof threshold !== 'number' || Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
      return false
    }
  }

  return true
}

export function sanitizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_SETTINGS }
  }

  const raw = value as Record<string, unknown>
  return {
    thresholds: isAlertThresholds(raw.thresholds) ? raw.thresholds : DEFAULT_THRESHOLDS,
    theme: isTheme(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    snapshotIntervalMin: isSnapshotInterval(raw.snapshotIntervalMin) ? raw.snapshotIntervalMin : DEFAULT_SETTINGS.snapshotIntervalMin
  }
}

export function validatePartialSettings(value: unknown): value is Partial<AppSettings> {
  if (!value || typeof value !== 'object') return false

  const raw = value as Record<string, unknown>
  if ('thresholds' in raw && !isAlertThresholds(raw.thresholds)) {
    return false
  }
  if ('theme' in raw && !isTheme(raw.theme)) {
    return false
  }
  if ('snapshotIntervalMin' in raw && !isSnapshotInterval(raw.snapshotIntervalMin)) {
    return false
  }

  return true
}
