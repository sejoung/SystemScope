import type { AlertThresholds } from './alert'
import type { AppLocale } from '@shared/i18n'
import type { AutomationSchedule, CleanupRuleConfig } from './automation'
import type { WorkspaceProfile } from './profile'

export interface HistorySettings {
  metricsIntervalSec: number
  metricsRetentionDays: number
  eventsRetentionDays: number
}

export interface DiagnosticsSettings {
  enabled: boolean
  intervalSec: number
}

export interface AppSettings {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
  locale: AppLocale
  snapshotIntervalMin: SnapshotIntervalMin
  history: HistorySettings
  diagnostics: DiagnosticsSettings
  automation: {
    schedule: AutomationSchedule
    rules: CleanupRuleConfig[]
  }
  profiles: WorkspaceProfile[]
  activeProfileId: string | null
}

export type AppSettingsPatch = Partial<AppSettings>

export type SnapshotIntervalMin = 15 | 30 | 60 | 120 | 360
