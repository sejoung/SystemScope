import { create } from 'zustand'
import type { ProjectMonitorSummary } from '@shared/types'
import { isProjectMonitorSummary } from '@shared/types/guards'

interface ProjectMonitorState {
  summary: ProjectMonitorSummary | null
  loading: boolean
  fetchSummary: () => Promise<void>
}

export const useProjectMonitorStore = create<ProjectMonitorState>((set, get) => ({
  summary: null,
  loading: false,

  fetchSummary: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const res = await window.systemScope.getProjectMonitorSummary()
      set({
        summary: res.ok && isProjectMonitorSummary(res.data) ? res.data : null,
        loading: false
      })
    } catch {
      set({ loading: false })
    }
  }
}))
