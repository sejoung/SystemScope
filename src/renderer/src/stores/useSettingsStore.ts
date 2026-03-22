import { create } from 'zustand'
import type { AlertThresholds } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'

export type AppPage = 'dashboard' | 'disk' | 'docker' | 'process' | 'settings'

interface SettingsState {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
  currentPage: AppPage
  setThresholds: (t: AlertThresholds) => void
  setTheme: (theme: 'dark' | 'light') => void
  setCurrentPage: (page: AppPage) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  thresholds: DEFAULT_THRESHOLDS,
  theme: 'dark',
  currentPage: 'dashboard',

  setThresholds: (t) => set({ thresholds: t }),
  setTheme: (theme) => set({ theme }),
  setCurrentPage: (page) => set({ currentPage: page })
}))
