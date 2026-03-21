import { create } from 'zustand'
import type { SystemStats } from '@shared/types'
import { HISTORY_MAX_POINTS } from '@shared/constants/intervals'

interface SystemState {
  current: SystemStats | null
  history: SystemStats[]
  isSubscribed: boolean
  pushStats: (stats: SystemStats) => void
  setSubscribed: (val: boolean) => void
}

export const useSystemStore = create<SystemState>((set) => ({
  current: null,
  history: [],
  isSubscribed: false,

  pushStats: (stats) =>
    set((state) => {
      const history = [...state.history, stats]
      if (history.length > HISTORY_MAX_POINTS) {
        history.shift()
      }
      return { current: stats, history }
    }),

  setSubscribed: (val) => set({ isSubscribed: val })
}))
