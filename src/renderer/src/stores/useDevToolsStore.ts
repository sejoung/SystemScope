import { create } from 'zustand'
import type { ToolIntegrationResult, ToolCleanResult } from '@shared/types'
import { isToolIntegrationResultArray, isToolCleanResult } from '@shared/types'
import { reportRendererError } from '../utils/rendererLogging'

interface DevToolsState {
  results: ToolIntegrationResult[]
  scanning: boolean
  scanned: boolean
  cleaning: boolean
  lastCleanResult: ToolCleanResult | null
  error: string | null

  scan: () => Promise<void>
  cleanItems: (paths: string[]) => Promise<ToolCleanResult | null>
}

export const useDevToolsStore = create<DevToolsState>((set, get) => ({
  results: [],
  scanning: false,
  scanned: false,
  cleaning: false,
  lastCleanResult: null,
  error: null,

  scan: async () => {
    if (get().scanning) return
    set({ scanning: true, error: null })
    try {
      const res = await window.systemScope.scanDevTools()
      if (res.ok && res.data && isToolIntegrationResultArray(res.data)) {
        set({ results: res.data, scanning: false, scanned: true })
      } else {
        const msg = !res.ok ? (res.error?.message ?? 'Scan failed') : 'Unexpected response'
        void reportRendererError('devtools-store', 'Failed to scan dev tools', { error: msg })
        set({ scanning: false, scanned: true, error: msg })
      }
    } catch (error) {
      void reportRendererError('devtools-store', 'Failed to scan dev tools', { error })
      set({ scanning: false, scanned: true, error: 'Scan failed' })
    }
  },

  cleanItems: async (paths: string[]) => {
    if (get().cleaning) return null
    set({ cleaning: true })
    try {
      const res = await window.systemScope.cleanDevToolItems(paths)
      if (res.ok && res.data && isToolCleanResult(res.data)) {
        set({ lastCleanResult: res.data, cleaning: false })
        return res.data
      } else {
        void reportRendererError('devtools-store', 'Failed to clean dev tool items', {})
        set({ cleaning: false })
        return null
      }
    } catch (error) {
      void reportRendererError('devtools-store', 'Failed to clean dev tool items', { error })
      set({ cleaning: false })
      return null
    }
  },
}))
