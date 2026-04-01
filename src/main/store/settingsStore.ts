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
    snapshotIntervalMin: store.get('snapshotIntervalMin'),
    history: store.get('history'),
    diagnostics: store.get('diagnostics'),
    automation: store.get('automation'),
    profiles: store.get('profiles'),
    activeProfileId: store.get('activeProfileId')
  })
}

export function setSettings(settings: Partial<AppSettings>): void {
  if (settings.thresholds !== undefined) store.set('thresholds', settings.thresholds)
  if (settings.theme !== undefined) store.set('theme', settings.theme)
  if (settings.locale !== undefined) store.set('locale', settings.locale)
  if (settings.snapshotIntervalMin !== undefined) store.set('snapshotIntervalMin', settings.snapshotIntervalMin)
  if (settings.history !== undefined) store.set('history', settings.history)
  if (settings.diagnostics !== undefined) store.set('diagnostics', settings.diagnostics)
  if (settings.automation !== undefined) store.set('automation', settings.automation)
  if (settings.profiles !== undefined) store.set('profiles', settings.profiles)
  if (settings.activeProfileId !== undefined) store.set('activeProfileId', settings.activeProfileId)
}
