import { create } from 'zustand'
import type { DiagnosisSummary } from '@shared/types'
import { isDiagnosisSummary } from '@shared/types/guards'

interface DiagnosisState {
  summary: DiagnosisSummary | null
  loading: boolean
  error: string | null
  fetchDiagnosis: () => Promise<void>
}

export const useDiagnosisStore = create<DiagnosisState>((set, get) => ({
  summary: null,
  loading: false,
  error: null,

  fetchDiagnosis: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.getDiagnosisSummary()
      if (res.ok && isDiagnosisSummary(res.data)) {
        set({ summary: res.data, loading: false })
      } else {
        set({
          loading: false,
          error: res.ok ? 'Invalid diagnosis data' : res.error.message
        })
      }
    } catch {
      set({ loading: false, error: 'Failed to fetch diagnosis' })
    }
  }
}))
