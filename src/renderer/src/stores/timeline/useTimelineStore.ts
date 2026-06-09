import { create } from 'zustand'
import type { TimelineData, TimelineRange, MetricPointDetail } from '@shared/types'
import { isTimelineData, isMetricPoint } from '@shared/types/guards'

interface TimelineState {
  range: TimelineRange
  data: TimelineData | null
  loading: boolean
  error: string | null
  selectedPoint: MetricPointDetail | null
  selectedPointLoading: boolean

  setRange: (range: TimelineRange) => void
  fetchTimeline: () => Promise<void>
  fetchPointDetail: (timestamp: number) => Promise<void>
  clearSelectedPoint: () => void
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  range: '24h',
  data: null,
  loading: false,
  error: null,
  selectedPoint: null,
  selectedPointLoading: false,

  setRange: (range) => set({ range }),

  fetchTimeline: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.getTimelineData(get().range)
      if (res.ok && isTimelineData(res.data)) {
        set({ data: res.data, loading: false })
      } else {
        set({
          loading: false,
          error: res.ok ? 'Invalid timeline data' : res.error.message
        })
      }
    } catch {
      set({ loading: false, error: 'Failed to fetch timeline data' })
    }
  },

  fetchPointDetail: async (timestamp) => {
    set({ selectedPointLoading: true })
    try {
      const res = await window.systemScope.getTimelinePointDetail(timestamp)
      if (res.ok && isMetricPoint(res.data)) {
        set({ selectedPoint: res.data as MetricPointDetail, selectedPointLoading: false })
      } else {
        set({ selectedPointLoading: false })
      }
    } catch {
      set({ selectedPointLoading: false })
    }
  },

  clearSelectedPoint: () => set({ selectedPoint: null })
}))
