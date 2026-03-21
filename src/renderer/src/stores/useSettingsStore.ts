import { create } from 'zustand'
import type { AlertThresholds } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'

interface SettingsState {
  thresholds: AlertThresholds
  theme: 'dark' | 'light'
  currentPage: string
  setThresholds: (t: AlertThresholds) => void
  setTheme: (theme: 'dark' | 'light') => void
  setCurrentPage: (page: string) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  thresholds: DEFAULT_THRESHOLDS,
  theme: 'dark',
  currentPage: 'dashboard',

  setThresholds: (t) => set({ thresholds: t }),
  setTheme: (theme) => set({ theme }),
  setCurrentPage: (page) => set({ currentPage: page })
}))
