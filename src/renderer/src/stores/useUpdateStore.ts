import { create } from 'zustand'
import type { UpdateInfo, UpdateStatus } from '@shared/types'

interface UpdateState {
  updateInfo: UpdateInfo | null
  checking: boolean
  lastCheckedAt: string | null
  dismissedVersion: string | null
  applyStatus: (status: UpdateStatus) => void
  setUpdateInfo: (info: UpdateInfo) => void
  setChecking: (checking: boolean) => void
  dismissCurrent: () => void
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  updateInfo: null,
  checking: false,
  lastCheckedAt: null,
  dismissedVersion: null,

  applyStatus: (status) =>
    set((state) => ({
      updateInfo: status.updateInfo,
      checking: status.checking,
      lastCheckedAt: status.lastCheckedAt,
      dismissedVersion:
        status.updateInfo && state.dismissedVersion && state.dismissedVersion !== status.updateInfo.latestVersion
          ? null
          : state.dismissedVersion
    })),

  setUpdateInfo: (updateInfo) =>
    set((state) => ({
      updateInfo,
      dismissedVersion:
        state.dismissedVersion && state.dismissedVersion !== updateInfo.latestVersion
          ? null
          : state.dismissedVersion
    })),

  setChecking: (checking) => set({ checking }),

  dismissCurrent: () => {
    const latestVersion = get().updateInfo?.latestVersion ?? null
    set({ dismissedVersion: latestVersion })
  }
}))
