import { create } from 'zustand'
import type { WorkspaceProfile } from '@shared/types'
import { isWorkspaceProfileArray, isWorkspaceProfile } from '@shared/types/guards'

interface ProfileState {
  profiles: WorkspaceProfile[]
  activeProfileId: string | null
  loading: boolean

  fetchProfiles: () => Promise<void>
  saveProfile: (profile: WorkspaceProfile) => Promise<WorkspaceProfile | null>
  deleteProfile: (id: string) => Promise<boolean>
  setActiveProfile: (id: string | null) => Promise<boolean>
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: [],
  activeProfileId: null,
  loading: false,

  fetchProfiles: async () => {
    set({ loading: true })
    try {
      const [profilesRes, settingsRes] = await Promise.all([
        window.systemScope.getProfiles(),
        window.systemScope.getSettings()
      ])
      const profiles = profilesRes.ok && isWorkspaceProfileArray(profilesRes.data) ? profilesRes.data : []
      const activeProfileId = settingsRes.ok && settingsRes.data && typeof settingsRes.data.activeProfileId === 'string'
        ? settingsRes.data.activeProfileId
        : null
      set({ profiles, activeProfileId, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  saveProfile: async (profile: WorkspaceProfile) => {
    try {
      const res = await window.systemScope.saveProfile(profile)
      if (res.ok && isWorkspaceProfile(res.data)) {
        const saved = res.data
        set((state) => {
          const exists = state.profiles.some((p) => p.id === saved.id)
          const profiles = exists
            ? state.profiles.map((p) => (p.id === saved.id ? saved : p))
            : [...state.profiles, saved]
          return { profiles }
        })
        return saved
      }
      return null
    } catch {
      return null
    }
  },

  deleteProfile: async (id: string) => {
    try {
      const res = await window.systemScope.deleteProfile(id)
      if (res.ok && res.data) {
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
          activeProfileId: state.activeProfileId === id ? null : state.activeProfileId
        }))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  setActiveProfile: async (id: string | null) => {
    try {
      const res = await window.systemScope.setActiveProfile(id)
      if (res.ok) {
        set({ activeProfileId: id })
        return true
      }
      return false
    } catch {
      return false
    }
  }
}))
