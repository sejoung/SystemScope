import { create } from 'zustand'
import type { SystemStats } from '@shared/types'
import { HISTORY_MAX_POINTS } from '@shared/constants/intervals'

interface SystemState {
  current: SystemStats | null
  history: SystemStats[]
  pushStats: (stats: SystemStats) => void
}

export const useSystemStore = create<SystemState>((set) => ({
  current: null,
  history: [],

  pushStats: (stats) =>
    set((state) => {
      const history = state.history.length >= HISTORY_MAX_POINTS
        ? [...state.history.slice(1), stats]
        : [...state.history, stats]
      return { current: stats, history }
    })
}))
