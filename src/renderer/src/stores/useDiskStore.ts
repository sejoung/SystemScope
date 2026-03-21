import { create } from 'zustand'
import type { DiskScanResult, LargeFile, ExtensionGroup, UserSpaceInfo } from '@shared/types'

interface DiskState {
  scanResult: DiskScanResult | null
  largeFiles: LargeFile[]
  extensions: ExtensionGroup[]
  isScanning: boolean
  scanJobId: string | null
  scanProgress: string
  selectedFolder: string | null

  // UserSpace cache
  userSpace: UserSpaceInfo | null
  userSpaceLoading: boolean

  setScanResult: (result: DiskScanResult) => void
  setLargeFiles: (files: LargeFile[]) => void
  setExtensions: (groups: ExtensionGroup[]) => void
  setScanning: (val: boolean, jobId?: string | null) => void
  setScanProgress: (progress: string) => void
  setSelectedFolder: (folder: string | null) => void
  clearScan: () => void

  setUserSpace: (info: UserSpaceInfo) => void
  setUserSpaceLoading: (val: boolean) => void
  fetchUserSpace: () => Promise<void>
}

export const useDiskStore = create<DiskState>((set, get) => ({
  scanResult: null,
  largeFiles: [],
  extensions: [],
  isScanning: false,
  scanJobId: null,
  scanProgress: '',
  selectedFolder: null,
  userSpace: null,
  userSpaceLoading: false,

  setScanResult: (result) => set({ scanResult: result, isScanning: false }),
  setLargeFiles: (files) => set({ largeFiles: files }),
  setExtensions: (groups) => set({ extensions: groups }),
  setScanning: (val, jobId = null) => set({ isScanning: val, scanJobId: jobId }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
  setSelectedFolder: (folder) => set({ selectedFolder: folder }),
  clearScan: () =>
    set({
      scanResult: null,
      largeFiles: [],
      extensions: [],
      isScanning: false,
      scanJobId: null,
      scanProgress: ''
    }),

  setUserSpace: (info) => set({ userSpace: info, userSpaceLoading: false }),
  setUserSpaceLoading: (val) => set({ userSpaceLoading: val }),

  fetchUserSpace: async () => {
    if (get().userSpaceLoading) return
    set({ userSpaceLoading: true })
    const res = await window.systemScope.getUserSpace()
    if (res.ok && res.data) {
      set({ userSpace: res.data as UserSpaceInfo, userSpaceLoading: false })
    } else {
      set({ userSpaceLoading: false })
    }
  }
}))
