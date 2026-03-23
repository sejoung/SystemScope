import ElectronStore from 'electron-store'
import { DEFAULT_SETTINGS, type AppSettings, sanitizeAppSettings } from './settingsSchema'

const Store = (ElectronStore as unknown as { default?: typeof ElectronStore }).default ?? ElectronStore

const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS
})

export function getSettings(): AppSettings {
  return sanitizeAppSettings({
    thresholds: store.get('thresholds'),
    theme: store.get('theme'),
    locale: store.get('locale'),
    snapshotIntervalMin: store.get('snapshotIntervalMin')
  })
}

export function setSettings(settings: Partial<AppSettings>): void {
  if (settings.thresholds) store.set('thresholds', settings.thresholds)
  if (settings.theme) store.set('theme', settings.theme)
  if (settings.locale) store.set('locale', settings.locale)
  if (settings.snapshotIntervalMin) store.set('snapshotIntervalMin', settings.snapshotIntervalMin)
}
