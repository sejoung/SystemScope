import Store from 'electron-store'
import { DEFAULT_SETTINGS, type AppSettings, sanitizeAppSettings } from './settingsSchema'

const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS
})

export function getSettings(): AppSettings {
  return sanitizeAppSettings({
    thresholds: store.get('thresholds'),
    theme: store.get('theme')
  })
}

export function setSettings(settings: Partial<AppSettings>): void {
  if (settings.thresholds) store.set('thresholds', settings.thresholds)
  if (settings.theme) store.set('theme', settings.theme)
}
