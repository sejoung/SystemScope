import type { AlertThresholds } from './alert'
import type { AppLocale } from '@shared/i18n'

export interface AppSettings {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
  locale: AppLocale
  snapshotIntervalMin: SnapshotIntervalMin
}

export type AppSettingsPatch = Partial<AppSettings>

export type SnapshotIntervalMin = 15 | 30 | 60 | 120 | 360
