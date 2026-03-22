import { create } from 'zustand'
import type { AlertThresholds } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'

export type AppPage = 'dashboard' | 'disk' | 'docker' | 'process' | 'apps' | 'settings'

interface SettingsState {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
  currentPage: AppPage
  hasUnsavedSettings: boolean
  setThresholds: (t: AlertThresholds) => void
  setTheme: (theme: 'dark' | 'light') => void
  setCurrentPage: (page: AppPage) => void
  setHasUnsavedSettings: (hasUnsaved: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  thresholds: DEFAULT_THRESHOLDS,
  theme: 'dark',
  currentPage: 'dashboard',
  hasUnsavedSettings: false,

  setThresholds: (t) => set({ thresholds: t }),
  setTheme: (theme) => set({ theme }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setHasUnsavedSettings: (hasUnsavedSettings) => set({ hasUnsavedSettings })
}))
