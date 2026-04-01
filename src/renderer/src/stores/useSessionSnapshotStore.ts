import { create } from 'zustand'
import type { SessionSnapshot, SnapshotDiff } from '@shared/types'
import { isSessionSnapshotArray, isSessionSnapshot, isSnapshotDiff } from '@shared/types/guards'

interface SessionSnapshotState {
  snapshots: SessionSnapshot[]
  loading: boolean
  error: string | null
  diff: SnapshotDiff | null
  diffLoading: boolean
  selectedIds: string[]

  fetchSnapshots: () => Promise<void>
  saveSnapshot: (label?: string) => Promise<SessionSnapshot | null>
  deleteSnapshot: (id: string) => Promise<boolean>
  toggleSelection: (id: string) => void
  clearSelection: () => void
  computeDiff: () => Promise<void>
}

export const useSessionSnapshotStore = create<SessionSnapshotState>((set, get) => ({
  snapshots: [],
  loading: false,
  error: null,
  diff: null,
  diffLoading: false,
  selectedIds: [],

  fetchSnapshots: async () => {
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.getSessionSnapshots()
      if (res.ok && isSessionSnapshotArray(res.data)) {
        set({ snapshots: res.data, loading: false })
      } else {
        set({ loading: false, error: res.ok ? 'Invalid snapshot data' : res.error.message })
      }
    } catch {
      set({ loading: false, error: 'Failed to fetch snapshots' })
    }
  },

  saveSnapshot: async (label?: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.saveSessionSnapshot(label)
      if (res.ok && isSessionSnapshot(res.data)) {
        set((state) => ({
          snapshots: [res.data, ...state.snapshots],
          loading: false,
        }))
        return res.data
      }
      set({ loading: false, error: res.ok ? 'Invalid snapshot data' : res.error.message })
      return null
    } catch {
      set({ loading: false, error: 'Failed to save snapshot' })
      return null
    }
  },

  deleteSnapshot: async (id: string) => {
    try {
      const res = await window.systemScope.deleteSessionSnapshot(id)
      if (res.ok) {
        set((state) => ({
          snapshots: state.snapshots.filter((s) => s.id !== id),
          selectedIds: state.selectedIds.filter((sid) => sid !== id),
          diff: state.diff && (state.diff.snapshot1.id === id || state.diff.snapshot2.id === id) ? null : state.diff,
        }))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  toggleSelection: (id: string) => {
    set((state) => {
      const selected = state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : state.selectedIds.length < 2
          ? [...state.selectedIds, id]
          : [state.selectedIds[1], id]
      return { selectedIds: selected, diff: null }
    })
  },

  clearSelection: () => set({ selectedIds: [], diff: null }),

  computeDiff: async () => {
    const { selectedIds } = get()
    if (selectedIds.length !== 2) return

    set({ diffLoading: true })
    try {
      const res = await window.systemScope.getSessionSnapshotDiff(selectedIds[0], selectedIds[1])
      if (res.ok && isSnapshotDiff(res.data)) {
        set({ diff: res.data, diffLoading: false })
      } else {
        set({ diffLoading: false })
      }
    } catch {
      set({ diffLoading: false })
    }
  },
}))
