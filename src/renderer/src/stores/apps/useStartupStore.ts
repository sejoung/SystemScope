import { create } from 'zustand'
import type { StartupItem } from '@shared/types'
import { isStartupItemArray, isStartupToggleResult } from '@shared/types/guards'

interface StartupState {
  items: StartupItem[]
  loading: boolean
  error: string | null
  /** True while `sfltool dumpbtm` runs (it may sit behind a macOS admin-password dialog). */
  btmScanning: boolean
  /** True once the list includes System Settings (BTM) items. */
  btmLoaded: boolean

  fetchItems: () => Promise<void>
  scanSystemSettingsItems: () => Promise<boolean>
  toggleItem: (id: string, enabled: boolean) => Promise<boolean>
}

export const useStartupStore = create<StartupState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  btmScanning: false,
  btmLoaded: false,

  fetchItems: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.getStartupItems()
      if (res.ok && isStartupItemArray(res.data)) {
        set({ items: res.data, loading: false, btmLoaded: false })
      } else {
        set({ loading: false, error: !res.ok ? res.error.message : 'Invalid data' })
      }
    } catch {
      set({ loading: false, error: 'Failed to fetch startup items' })
    }
  },

  scanSystemSettingsItems: async () => {
    if (get().btmScanning) return false
    set({ btmScanning: true })
    try {
      const res = await window.systemScope.scanStartupItemsWithSystemSettings()
      if (res.ok && isStartupItemArray(res.data)) {
        set({ items: res.data, btmScanning: false, btmLoaded: true })
        return true
      }
      set({ btmScanning: false })
      return false
    } catch {
      set({ btmScanning: false })
      return false
    }
  },

  toggleItem: async (id: string, enabled: boolean) => {
    // Optimistic update
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, enabled } : i))
    }))
    try {
      const res = await window.systemScope.toggleStartupItem(id, enabled)
      if (res.ok && isStartupToggleResult(res.data) && res.data.success) {
        return true
      }
      // Revert on failure
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, enabled: !enabled } : i))
      }))
      return false
    } catch {
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, enabled: !enabled } : i))
      }))
      return false
    }
  },
}))
