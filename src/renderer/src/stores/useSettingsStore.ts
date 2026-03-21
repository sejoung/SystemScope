import { create } from 'zustand'
import type { AlertThresholds } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'

interface SettingsState {
  thresholds: AlertThresholds
  currentPage: string
  setThresholds: (t: AlertThresholds) => void
  setCurrentPage: (page: string) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  thresholds: DEFAULT_THRESHOLDS,
  currentPage: 'dashboard',

  setThresholds: (t) => set({ thresholds: t }),
  setCurrentPage: (page) => set({ currentPage: page })
}))
