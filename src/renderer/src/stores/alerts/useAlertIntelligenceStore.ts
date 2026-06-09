import { create } from 'zustand'
import type { AlertIntelligence, AlertHistoryEntry } from '@shared/types'
import { isAlertIntelligence } from '@shared/types/guards'

interface AlertIntelligenceState {
  intelligence: AlertIntelligence | null
  history: AlertHistoryEntry[]
  loading: boolean
  error: string | null
  fetchIntelligence: () => Promise<void>
  fetchHistory: (limit?: number) => Promise<void>
}

function isAlertHistoryArray(data: unknown): data is AlertHistoryEntry[] {
  return (
    Array.isArray(data) &&
    (data.length === 0 ||
      (typeof data[0] === 'object' &&
        data[0] !== null &&
        'id' in data[0] &&
        'type' in data[0] &&
        'firedAt' in data[0]))
  )
}

export const useAlertIntelligenceStore = create<AlertIntelligenceState>((set, get) => ({
  intelligence: null,
  history: [],
  loading: false,
  error: null,

  fetchIntelligence: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.getAlertIntelligence()
      if (res.ok && isAlertIntelligence(res.data)) {
        set({ intelligence: res.data, loading: false })
      } else {
        set({
          loading: false,
          error: res.ok ? 'Invalid alert intelligence data' : res.error.message
        })
      }
    } catch {
      set({ loading: false, error: 'Failed to fetch alert intelligence' })
    }
  },

  fetchHistory: async (limit?) => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.getAlertHistory(limit)
      if (res.ok && isAlertHistoryArray(res.data)) {
        set({ history: res.data, loading: false })
      } else {
        set({
          loading: false,
          error: res.ok ? 'Invalid alert history data' : res.error.message
        })
      }
    } catch {
      set({ loading: false, error: 'Failed to fetch alert history' })
    }
  }
}))
