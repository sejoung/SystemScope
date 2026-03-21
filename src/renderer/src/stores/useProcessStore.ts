import { create } from 'zustand'
import type { ProcessInfo } from '@shared/types'

type SortBy = 'cpu' | 'memory'

interface ProcessState {
  cpuProcesses: ProcessInfo[]
  memoryProcesses: ProcessInfo[]
  sortBy: SortBy
  setCpuProcesses: (procs: ProcessInfo[]) => void
  setMemoryProcesses: (procs: ProcessInfo[]) => void
  setSortBy: (sort: SortBy) => void
}

export const useProcessStore = create<ProcessState>((set) => ({
  cpuProcesses: [],
  memoryProcesses: [],
  sortBy: 'cpu',

  setCpuProcesses: (procs) => set({ cpuProcesses: procs }),
  setMemoryProcesses: (procs) => set({ memoryProcesses: procs }),
  setSortBy: (sort) => set({ sortBy: sort })
}))
