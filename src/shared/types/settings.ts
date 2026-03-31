import type { AlertThresholds } from './alert'
import type { AppLocale } from '@shared/i18n'

export interface HistorySettings {
  metricsIntervalSec: number
  metricsRetentionDays: number
  eventsRetentionDays: number
}

export interface AppSettings {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
  locale: AppLocale
  snapshotIntervalMin: SnapshotIntervalMin
  history: HistorySettings
}

export type AppSettingsPatch = Partial<AppSettings>

export type SnapshotIntervalMin = 15 | 30 | 60 | 120 | 360
