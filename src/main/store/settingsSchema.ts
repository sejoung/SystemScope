import type { AlertThresholds } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'

export interface AppSettings {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
}

export const DEFAULT_SETTINGS: AppSettings = {
  thresholds: DEFAULT_THRESHOLDS,
  theme: 'dark'
}

const THRESHOLD_KEYS = [
  'diskWarning',
  'diskCritical',
  'memoryWarning',
  'memoryCritical',
  'gpuMemoryWarning',
  'gpuMemoryCritical'
] as const satisfies readonly (keyof AlertThresholds)[]

export function isTheme(value: unknown): value is AppSettings['theme'] {
  return value === 'dark' || value === 'light'
}

export function isAlertThresholds(value: unknown): value is AlertThresholds {
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
    theme: isTheme(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme
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

  return true
}
