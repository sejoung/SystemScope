import { create } from 'zustand'
import type {
  NetworkCaptureCapability,
  NetworkCaptureStatus,
  NetworkCaptureUpdate,
  NetworkFlowSummary
} from '@shared/types'

interface NetworkCaptureState {
  capability: NetworkCaptureCapability | null
  status: NetworkCaptureStatus | null
  recentFlows: NetworkFlowSummary[]
  selectedFlowId: string | null
  loading: boolean
  error: string | null
  unsubscribe: (() => void) | null

  hydrate: () => Promise<void>
  connect: () => Promise<void>
  disconnect: () => void
  selectFlow: (id: string | null) => void
  startCapture: () => Promise<boolean>
  stopCapture: () => Promise<boolean>
  clearCapture: () => Promise<boolean>
}

function getNextSelectedFlowId(
  currentSelectedFlowId: string | null,
  recentFlows: NetworkFlowSummary[]
): string | null {
  if (recentFlows.length === 0) return null
  if (currentSelectedFlowId && recentFlows.some((flow) => flow.id === currentSelectedFlowId)) {
    return currentSelectedFlowId
  }
  return recentFlows[0]?.id ?? null
}

export const useNetworkCaptureStore = create<NetworkCaptureState>((set, get) => ({
  capability: null,
  status: null,
  recentFlows: [],
  selectedFlowId: null,
  loading: false,
  error: null,
  unsubscribe: null,

  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const [capabilityRes, statusRes, flowsRes] = await Promise.all([
        window.systemScope.getNetworkCaptureCapability(),
        window.systemScope.getNetworkCaptureStatus(),
        window.systemScope.listRecentNetworkFlows(100),
      ])

      if (!capabilityRes.ok || !statusRes.ok || !flowsRes.ok) {
        set({
          loading: false,
          error: !capabilityRes.ok
            ? capabilityRes.error.message
            : !statusRes.ok
              ? statusRes.error.message
              : !flowsRes.ok
                ? flowsRes.error.message
                : 'Failed to load network capture state.'
        })
        return
      }

      const recentFlows = flowsRes.data
      set((state) => ({
        capability: capabilityRes.data,
        status: statusRes.data,
        recentFlows,
        selectedFlowId: getNextSelectedFlowId(state.selectedFlowId, recentFlows),
        loading: false,
        error: null
      }))
    } catch {
      set({ loading: false, error: 'Failed to load network capture state.' })
    }
  },

  connect: async () => {
    if (!get().unsubscribe) {
      const unsubscribe = window.systemScope.onNetworkCaptureUpdate((data) => {
        const update = data as NetworkCaptureUpdate
        if (!update || typeof update !== 'object' || !Array.isArray(update.recentFlows) || !update.status) {
          return
        }

        set((state) => ({
          status: update.status,
          recentFlows: update.recentFlows,
          selectedFlowId: getNextSelectedFlowId(state.selectedFlowId, update.recentFlows),
        }))
      })
      set({ unsubscribe })
    }

    await get().hydrate()
  },

  disconnect: () => {
    const unsubscribe = get().unsubscribe
    if (unsubscribe) unsubscribe()
    set({ unsubscribe: null })
  },

  selectFlow: (id) => set({ selectedFlowId: id }),

  startCapture: async () => {
    try {
      const res = await window.systemScope.startNetworkCapture()
      await get().hydrate()
      return res.ok ? Boolean(res.data) : false
    } catch {
      set({ error: 'Failed to start network capture.' })
      return false
    }
  },

  stopCapture: async () => {
    try {
      const res = await window.systemScope.stopNetworkCapture()
      await get().hydrate()
      return res.ok ? Boolean(res.data) : false
    } catch {
      set({ error: 'Failed to stop network capture.' })
      return false
    }
  },

  clearCapture: async () => {
    try {
      const res = await window.systemScope.clearNetworkCapture()
      await get().hydrate()
      return res.ok ? Boolean(res.data) : false
    } catch {
      set({ error: 'Failed to clear recent network flows.' })
      return false
    }
  },
}))
