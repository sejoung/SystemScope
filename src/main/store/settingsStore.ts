import type ElectronStore from 'electron-store'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS, sanitizeAppSettings } from './settingsSchema'

// Instantiate lazily AND require electron-store lazily. electron-store `require()`s
// the electron binary at module load, which throws outside a running Electron app
// (e.g. unit tests that transitively import this module via a service barrel). Doing
// both the import and construction on first real settings access keeps importing this
// module completely side-effect free.
let storeInstance: ElectronStore<AppSettings> | null = null
function store(): ElectronStore<AppSettings> {
  if (!storeInstance) {
    // electron-store v11 ships ESM with a default export, but electron-vite may
    // resolve it as CJS — this dual lookup finds the constructor either way.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('electron-store') as { default?: typeof ElectronStore }
    const Store = mod.default ?? (mod as unknown as typeof ElectronStore)
    storeInstance = new Store<AppSettings>({ defaults: DEFAULT_SETTINGS })
  }
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
