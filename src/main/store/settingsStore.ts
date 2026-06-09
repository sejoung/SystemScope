import ElectronStore from 'electron-store'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS, sanitizeAppSettings } from './settingsSchema'

// electron-store v11 ships ESM with a default export, but electron-vite may
// resolve it as CJS depending on the interop mode. This dual-import pattern
// ensures the constructor is found regardless of how the module is loaded.
const Store = (ElectronStore as unknown as { default?: typeof ElectronStore }).default ?? ElectronStore

// Instantiate lazily: ElectronStore touches the app's userData path at construction,
// which fails outside a running Electron app (e.g. unit tests that transitively import
// this module via a service barrel). Creating it on first use keeps importing this
// module side-effect free.
let storeInstance: ElectronStore<AppSettings> | null = null
function store(): ElectronStore<AppSettings> {
  storeInstance ??= new Store<AppSettings>({ defaults: DEFAULT_SETTINGS })
  return storeInstance
}

export function getSettings(): AppSettings {
  const s = store()
  return sanitizeAppSettings({
    thresholds: s.get('thresholds'),
    theme: s.get('theme'),
    locale: s.get('locale'),
    snapshotIntervalMin: s.get('snapshotIntervalMin'),
    history: s.get('history'),
    diagnostics: s.get('diagnostics'),
    automation: s.get('automation'),
    profiles: s.get('profiles'),
    activeProfileId: s.get('activeProfileId')
  })
}

export function setSettings(settings: Partial<AppSettings>): void {
  const s = store()
  if (settings.thresholds !== undefined) s.set('thresholds', settings.thresholds)
  if (settings.theme !== undefined) s.set('theme', settings.theme)
  if (settings.locale !== undefined) s.set('locale', settings.locale)
  if (settings.snapshotIntervalMin !== undefined) s.set('snapshotIntervalMin', settings.snapshotIntervalMin)
  if (settings.history !== undefined) s.set('history', settings.history)
  if (settings.diagnostics !== undefined) s.set('diagnostics', settings.diagnostics)
  if (settings.automation !== undefined) s.set('automation', settings.automation)
  if (settings.profiles !== undefined) s.set('profiles', settings.profiles)
  if (settings.activeProfileId !== undefined) s.set('activeProfileId', settings.activeProfileId)
}
