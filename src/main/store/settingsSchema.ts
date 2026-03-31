import type { AlertThresholds, AppSettings, DiagnosticsSettings, HistorySettings, SnapshotIntervalMin, AutomationSchedule, CleanupRuleConfig, CleanupRuleId } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'
import type { AppLocale } from '@shared/i18n'

export const SNAPSHOT_INTERVAL_OPTIONS = [15, 30, 60, 120, 360] as const

export const DEFAULT_HISTORY_SETTINGS: HistorySettings = {
  metricsIntervalSec: 60,
  metricsRetentionDays: 30,
  eventsRetentionDays: 90
}

export const DEFAULT_DIAGNOSTICS_SETTINGS: DiagnosticsSettings = {
  enabled: true,
  intervalSec: 300
}

export const DEFAULT_AUTOMATION_SCHEDULE: AutomationSchedule = {
  enabled: false,
  frequency: 'weekly'
}

const ALL_CLEANUP_RULE_IDS: CleanupRuleId[] = [
  'downloads_old_files',
  'xcode_derived_data',
  'xcode_archives',
  'npm_cache',
  'pnpm_cache',
  'yarn_cache',
  'docker_stopped_containers',
  'old_logs',
  'temp_files'
]

export const DEFAULT_CLEANUP_RULES: CleanupRuleConfig[] = ALL_CLEANUP_RULE_IDS.map((id) => ({
  id,
  enabled: true,
  minAgeDays: 30
}))

export const DEFAULT_AUTOMATION_SETTINGS: AppSettings['automation'] = {
  schedule: DEFAULT_AUTOMATION_SCHEDULE,
  rules: DEFAULT_CLEANUP_RULES
}

export const DEFAULT_SETTINGS: AppSettings = {
  thresholds: DEFAULT_THRESHOLDS,
  theme: 'dark',
  locale: 'en',
  snapshotIntervalMin: 60,
  history: DEFAULT_HISTORY_SETTINGS,
  diagnostics: DEFAULT_DIAGNOSTICS_SETTINGS,
  automation: DEFAULT_AUTOMATION_SETTINGS
}

function isSnapshotInterval(value: unknown): value is SnapshotIntervalMin {
  return typeof value === 'number' && SNAPSHOT_INTERVAL_OPTIONS.includes(value as SnapshotIntervalMin)
}

const THRESHOLD_KEYS = [
  'cpuWarning',
  'cpuCritical',
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

function isLocale(value: unknown): value is AppLocale {
  return value === 'ko' || value === 'en'
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

function isHistorySettings(value: unknown): value is HistorySettings {
  if (!value || typeof value !== 'object') return false
  const h = value as Record<string, unknown>
  return (
    typeof h.metricsIntervalSec === 'number' && h.metricsIntervalSec > 0 &&
    typeof h.metricsRetentionDays === 'number' && h.metricsRetentionDays > 0 &&
    typeof h.eventsRetentionDays === 'number' && h.eventsRetentionDays > 0
  )
}

function isDiagnosticsSettings(value: unknown): value is DiagnosticsSettings {
  if (!value || typeof value !== 'object') return false
  const d = value as Record<string, unknown>
  return (
    typeof d.enabled === 'boolean' &&
    typeof d.intervalSec === 'number' && d.intervalSec > 0
  )
}

function isAutomationSettings(value: unknown): value is AppSettings['automation'] {
  if (!value || typeof value !== 'object') return false
  const a = value as Record<string, unknown>
  if (!a.schedule || typeof a.schedule !== 'object') return false
  const s = a.schedule as Record<string, unknown>
  if (typeof s.enabled !== 'boolean') return false
  if (s.frequency !== 'daily' && s.frequency !== 'weekly' && s.frequency !== 'manual') return false
  if (!Array.isArray(a.rules)) return false
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
    locale: isLocale(raw.locale) ? raw.locale : DEFAULT_SETTINGS.locale,
    snapshotIntervalMin: isSnapshotInterval(raw.snapshotIntervalMin) ? raw.snapshotIntervalMin : DEFAULT_SETTINGS.snapshotIntervalMin,
    history: isHistorySettings(raw.history) ? raw.history : DEFAULT_HISTORY_SETTINGS,
    diagnostics: isDiagnosticsSettings(raw.diagnostics) ? raw.diagnostics : DEFAULT_DIAGNOSTICS_SETTINGS,
    automation: isAutomationSettings(raw.automation) ? raw.automation : DEFAULT_AUTOMATION_SETTINGS
  }
}

const KNOWN_SETTINGS_KEYS = new Set<string>(['thresholds', 'theme', 'locale', 'snapshotIntervalMin', 'history', 'diagnostics', 'automation'])

export function validatePartialSettings(value: unknown): value is Partial<AppSettings> {
  if (!value || typeof value !== 'object') return false

  const raw = value as Record<string, unknown>

  // unknown key가 포함되면 거부 (오타 방지)
  for (const key of Object.keys(raw)) {
    if (!KNOWN_SETTINGS_KEYS.has(key)) return false
  }

  if ('thresholds' in raw && !isAlertThresholds(raw.thresholds)) {
    return false
  }
  if ('theme' in raw && !isTheme(raw.theme)) {
    return false
  }
  if ('locale' in raw && !isLocale(raw.locale)) {
    return false
  }
  if ('snapshotIntervalMin' in raw && !isSnapshotInterval(raw.snapshotIntervalMin)) {
    return false
  }
  if ('history' in raw && !isHistorySettings(raw.history)) {
    return false
  }
  if ('diagnostics' in raw && !isDiagnosticsSettings(raw.diagnostics)) {
    return false
  }
  if ('automation' in raw && !isAutomationSettings(raw.automation)) {
    return false
  }

  return true
}
