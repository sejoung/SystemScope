import { create } from 'zustand'
import type { SystemEvent, SystemEventCategory } from '@shared/types'
import { isSystemEventArray } from '@shared/types/guards'

interface EventState {
  events: SystemEvent[]
  loading: boolean
  error: string | null
  filter: SystemEventCategory | null

  fetchEvents: (limit?: number) => Promise<void>
  fetchFilteredEvents: (category: SystemEventCategory) => Promise<void>
  setFilter: (category: SystemEventCategory | null) => void
  clearEvents: () => void
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,
  error: null,
  filter: null,

  fetchEvents: async (limit?) => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.getRecentEvents(limit)
      if (res.ok && isSystemEventArray(res.data)) {
        set({ events: res.data, loading: false })
      } else {
        set({
          loading: false,
          error: res.ok ? 'Invalid event data' : res.error.message
        })
      }
    } catch {
      set({ loading: false, error: 'Failed to fetch events' })
    }
  },

  fetchFilteredEvents: async (category) => {
    if (get().loading) return
    set({ loading: true, error: null, filter: category })
    try {
      const res = await window.systemScope.getEventHistory({ category })
      if (res.ok && isSystemEventArray(res.data)) {
        set({ events: res.data, loading: false })
      } else {
        set({
          loading: false,
          error: res.ok ? 'Invalid event data' : res.error.message
        })
      }
    } catch {
      set({ loading: false, error: 'Failed to fetch filtered events' })
    }
  },

  setFilter: (category) => set({ filter: category }),

  clearEvents: () => set({ events: [], error: null, filter: null })
}))
