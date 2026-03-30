import ElectronStore from 'electron-store'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS, sanitizeAppSettings } from './settingsSchema'

// electron-store v11 ships ESM with a default export, but electron-vite may
// resolve it as CJS depending on the interop mode. This dual-import pattern
// ensures the constructor is found regardless of how the module is loaded.
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
  if (settings.thresholds !== undefined) store.set('thresholds', settings.thresholds)
  if (settings.theme !== undefined) store.set('theme', settings.theme)
  if (settings.locale !== undefined) store.set('locale', settings.locale)
  if (settings.snapshotIntervalMin !== undefined) store.set('snapshotIntervalMin', settings.snapshotIntervalMin)
}
