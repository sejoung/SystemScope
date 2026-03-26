import { create } from 'zustand'
import type { DiskScanResult, LargeFile, ExtensionGroup, UserSpaceInfo, GrowthViewResult, QuickScanFolder } from '@shared/types'

interface QuickScanState {
  results: QuickScanFolder[]
  scanning: boolean
  scanned: boolean
  error: string | null
}

const QUICK_SCAN_INITIAL: QuickScanState = {
  results: [],
  scanning: false,
  scanned: false,
  error: null
}

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
  userSpaceFetched: boolean

  // GrowthView cache
  growthView: GrowthViewResult | null
  growthViewLoading: boolean
  growthViewPeriod: string

  quickScan: QuickScanState

  setScanResult: (result: DiskScanResult) => void
  setLargeFiles: (files: LargeFile[]) => void
  setExtensions: (groups: ExtensionGroup[]) => void
  setScanning: (val: boolean, jobId?: string | null) => void
  setScanProgress: (progress: string) => void
  setSelectedFolder: (folder: string | null) => void
  removeLargeFilesByPaths: (paths: string[]) => void
  clearScan: () => void

  setUserSpace: (info: UserSpaceInfo) => void
  setUserSpaceLoading: (val: boolean) => void
  fetchUserSpace: () => Promise<void>

  setGrowthViewPeriod: (period: string) => void
  fetchGrowthView: (period?: string) => Promise<void>

  setQuickScanState: (state: QuickScanState | ((state: QuickScanState) => QuickScanState)) => void
  resetQuickScan: () => void
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
  userSpaceFetched: false,
  growthView: null,
  growthViewLoading: false,
  growthViewPeriod: '24h',
  quickScan: QUICK_SCAN_INITIAL,

  setScanResult: (result) => set({ scanResult: result, isScanning: false }),
  setLargeFiles: (files) => set({ largeFiles: files }),
  setExtensions: (groups) => set({ extensions: groups }),
  setScanning: (val, jobId = null) => set({ isScanning: val, scanJobId: jobId }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
  setSelectedFolder: (folder) => set({ selectedFolder: folder }),
  removeLargeFilesByPaths: (paths) => {
    const pathSet = new Set(paths)
    set((state) => ({
      largeFiles: state.largeFiles.filter((file) => !pathSet.has(file.path))
    }))
  },
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
    set({ userSpaceLoading: true, userSpaceFetched: true })
    const res = await window.systemScope.getUserSpace()
    if (res.ok && res.data) {
      set({ userSpace: res.data as UserSpaceInfo, userSpaceLoading: false })
    } else {
      set({ userSpaceLoading: false })
    }
  },

  setGrowthViewPeriod: (period) => set({ growthViewPeriod: period }),

  fetchGrowthView: async (period?: string) => {
    if (get().growthViewLoading) return
    const target = period ?? get().growthViewPeriod
    set({ growthViewLoading: true, growthViewPeriod: target })
    const res = await window.systemScope.getGrowthView(target)
    if (res.ok && res.data) {
      set({ growthView: res.data as GrowthViewResult, growthViewLoading: false })
    } else {
      set({ growthViewLoading: false })
    }
  },

  setQuickScanState: (nextState) => set((state) => ({
    quickScan: typeof nextState === 'function'
      ? nextState(state.quickScan)
      : nextState
  })),

  resetQuickScan: () => set({ quickScan: QUICK_SCAN_INITIAL })
}))
