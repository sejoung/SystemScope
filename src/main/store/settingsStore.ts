import Store from 'electron-store'
import type { AlertThresholds } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'

interface AppSettings {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
}

const store = new Store<AppSettings>({
  defaults: {
    thresholds: DEFAULT_THRESHOLDS,
    theme: 'dark'
  }
})

export function getSettings(): AppSettings {
  return {
    thresholds: store.get('thresholds'),
    theme: store.get('theme')
  }
}

export function setSettings(settings: Partial<AppSettings>): void {
  if (settings.thresholds) store.set('thresholds', settings.thresholds)
  if (settings.theme) store.set('theme', settings.theme)
}
