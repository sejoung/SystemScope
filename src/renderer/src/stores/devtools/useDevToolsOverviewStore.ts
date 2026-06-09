import { create } from 'zustand'
import type { DevToolsOverview } from '@shared/types'
import { isDevToolsOverview } from '@shared/types/guards'

interface DevToolsOverviewState {
  overview: DevToolsOverview | null
  loading: boolean
  error: string | null
  fetchOverview: (options?: { forceRefresh?: boolean }) => Promise<void>
}

export const useDevToolsOverviewStore = create<DevToolsOverviewState>((set, get) => ({
  overview: null,
  loading: false,
  error: null,

  fetchOverview: async (options) => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.getDevToolsOverview(options)
      if (res.ok && isDevToolsOverview(res.data)) {
        set({ overview: res.data, loading: false })
        return
      }
      if (!res.ok) {
        set({ loading: false, error: res.error?.message ?? 'Failed to load developer tooling overview.' })
        return
      }
      set({ loading: false, error: 'Failed to load developer tooling overview.' })
    } catch {
      set({ loading: false, error: 'Failed to load developer tooling overview.' })
    }
  },
}))
