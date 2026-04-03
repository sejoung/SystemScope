import { create } from 'zustand'
import type { AlertThresholds } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'
import type { AppLocale } from '@shared/i18n'

export type AppPage = 'dashboard' | 'timeline' | 'disk' | 'docker' | 'cleanup' | 'process' | 'devtools' | 'apps' | 'settings'
export type DockerTab = 'overview' | 'containers' | 'images' | 'volumes' | 'build-cache'

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
  dockerTab: 'overview',
  hasUnsavedSettings: false,

  setThresholds: (t) => set({ thresholds: t }),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setDockerTab: (dockerTab) => set({ dockerTab }),
  setHasUnsavedSettings: (hasUnsavedSettings) => set({ hasUnsavedSettings })
}))
