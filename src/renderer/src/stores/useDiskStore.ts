import { create } from 'zustand'
import type { DriveInfo, DiskScanResult, LargeFile, ExtensionGroup } from '@shared/types'

interface UserSpaceEntry {
  name: string
  path: string
  size: number
  icon: string
}

interface UserSpaceInfo {
  homePath: string
  homeSize: number
  diskTotal: number
  diskAvailable: number
  diskUsage: number
  purgeable: number | null
  entries: UserSpaceEntry[]
}

interface DiskState {
  drives: DriveInfo[]
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

  setDrives: (drives: DriveInfo[]) => void
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
  drives: [],
  scanResult: null,
  largeFiles: [],
  extensions: [],
  isScanning: false,
  scanJobId: null,
  scanProgress: '',
  selectedFolder: null,
  userSpace: null,
  userSpaceLoading: false,

  setDrives: (drives) => set({ drives }),
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
    // 이미 로딩 중이면 중복 호출 방지
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
