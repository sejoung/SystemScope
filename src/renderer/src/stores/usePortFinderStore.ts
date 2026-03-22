import { create } from 'zustand'
import type { PortInfo } from '@shared/types'

type StateFilter = 'all' | 'LISTEN' | 'ESTABLISHED' | 'other'

interface PortFinderState {
  ports: PortInfo[]
  loading: boolean
  scanned: boolean
  stateFilter: StateFilter
  setPorts: (ports: PortInfo[]) => void
  setLoading: (val: boolean) => void
  setScanned: (val: boolean) => void
  setStateFilter: (filter: StateFilter) => void
  fetchPorts: () => Promise<void>
}

export const usePortFinderStore = create<PortFinderState>((set, get) => ({
  ports: [],
  loading: false,
  scanned: false,
  stateFilter: 'all',

  setPorts: (ports) => set({ ports }),
  setLoading: (val) => set({ loading: val }),
  setScanned: (val) => set({ scanned: val }),
  setStateFilter: (filter) => set({ stateFilter: filter }),

  fetchPorts: async () => {
    if (get().loading) return
    set({ loading: true })
    const res = await window.systemScope.getNetworkPorts()
    if (res.ok && res.data) {
      set({ ports: res.data as PortInfo[], loading: false, scanned: true })
    } else {
      set({ loading: false, scanned: true })
    }
  }
}))
