import { create } from 'zustand'
import type { PortInfo } from '@shared/types'

type StateFilter = 'all' | 'LISTEN' | 'ESTABLISHED' | 'other'
type RequestState = 'idle' | 'started' | 'completed' | 'failed'
type SearchScope = 'local' | 'remote' | 'process' | 'all'

interface PortFinderState {
  ports: PortInfo[]
  loading: boolean
  scanned: boolean
  error: string | null
  requestState: RequestState
  stateFilter: StateFilter
  search: string
  searchScope: SearchScope
  setPorts: (ports: PortInfo[]) => void
  setLoading: (val: boolean) => void
  setScanned: (val: boolean) => void
  setError: (error: string | null) => void
  setRequestState: (state: RequestState) => void
  setStateFilter: (filter: StateFilter) => void
  setSearch: (search: string) => void
  setSearchScope: (scope: SearchScope) => void
  fetchPorts: () => Promise<void>
}

export const usePortFinderStore = create<PortFinderState>((set, get) => ({
  ports: [],
  loading: false,
  scanned: false,
  error: null,
  requestState: 'idle',
  stateFilter: 'LISTEN',
  search: '',
  searchScope: 'process',

  setPorts: (ports) => set({ ports }),
  setLoading: (val) => set({ loading: val }),
  setScanned: (val) => set({ scanned: val }),
  setError: (error) => set({ error }),
  setRequestState: (requestState) => set({ requestState }),
  setStateFilter: (filter) => set({ stateFilter: filter }),
  setSearch: (search) => set({ search }),
  setSearchScope: (searchScope) => set({ searchScope }),

  fetchPorts: async () => {
    if (get().loading) return
    set({ loading: true, error: null, requestState: 'started' })
    const res = await window.systemScope.getNetworkPorts()
    if (res.ok && res.data) {
      set({
        ports: res.data as PortInfo[],
        loading: false,
        scanned: true,
        error: null,
        requestState: 'completed'
      })
    } else {
      set({
        ports: [],
        loading: false,
        scanned: true,
        error: res.error?.message ?? 'Unable to fetch port information.',
        requestState: 'failed'
      })
    }
  }
}))
