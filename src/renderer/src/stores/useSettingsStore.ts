import { create } from 'zustand'
import type { AlertThresholds } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'
import type { AppLocale } from '@shared/i18n'

export type AppPage = 'dashboard' | 'timeline' | 'disk' | 'docker' | 'cleanup' | 'process' | 'devtools' | 'apps' | 'settings'
export type DockerTab = 'overview' | 'containers' | 'images' | 'volumes' | 'build-cache'
const DOCKER_TAB_STORAGE_KEY = 'systemscope.dockerTab'

interface SettingsState {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
  locale: AppLocale
  currentPage: AppPage
  dockerTab: DockerTab
  hasUnsavedSettings: boolean
  setThresholds: (t: AlertThresholds) => void
  setTheme: (theme: 'dark' | 'light') => void
  setLocale: (locale: AppLocale) => void
  setCurrentPage: (page: AppPage) => void
  setDockerTab: (tab: DockerTab) => void
  setHasUnsavedSettings: (hasUnsaved: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  thresholds: DEFAULT_THRESHOLDS,
  theme: 'dark',
  locale: 'en',
  currentPage: 'dashboard',
  dockerTab: loadDockerTab(),
  hasUnsavedSettings: false,

  setThresholds: (t) => set({ thresholds: t }),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setDockerTab: (dockerTab) => {
    saveDockerTab(dockerTab)
    set({ dockerTab })
  },
  setHasUnsavedSettings: (hasUnsavedSettings) => set({ hasUnsavedSettings })
}))

function loadDockerTab(): DockerTab {
  try {
    const stored = getSafeLocalStorage()?.getItem(DOCKER_TAB_STORAGE_KEY)
    return isDockerTab(stored) ? stored : 'overview'
  } catch {
    return 'overview'
  }
}

function saveDockerTab(tab: DockerTab): void {
  try {
    getSafeLocalStorage()?.setItem(DOCKER_TAB_STORAGE_KEY, tab)
  } catch {
    // Ignore storage failures and keep the in-memory state.
  }
}

function getSafeLocalStorage(): Storage | undefined {
  try {
    if (typeof globalThis === 'undefined') return undefined
    const storage = (globalThis as { localStorage?: Storage }).localStorage
    return storage ?? undefined
  } catch {
    return undefined
  }
}

function isDockerTab(value: unknown): value is DockerTab {
  return value === 'overview'
    || value === 'containers'
    || value === 'images'
    || value === 'volumes'
    || value === 'build-cache'
}
