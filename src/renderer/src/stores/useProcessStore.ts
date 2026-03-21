import { create } from 'zustand'
import type { ProcessInfo } from '@shared/types'

interface ProcessState {
  cpuProcesses: ProcessInfo[]
  memoryProcesses: ProcessInfo[]
  allProcesses: ProcessInfo[]
  allProcessesLoading: boolean
  setCpuProcesses: (procs: ProcessInfo[]) => void
  setMemoryProcesses: (procs: ProcessInfo[]) => void
  setAllProcesses: (procs: ProcessInfo[]) => void
  setAllProcessesLoading: (val: boolean) => void
}

export const useProcessStore = create<ProcessState>((set) => ({
  cpuProcesses: [],
  memoryProcesses: [],
  allProcesses: [],
  allProcessesLoading: false,
  setCpuProcesses: (procs) => set({ cpuProcesses: procs }),
  setMemoryProcesses: (procs) => set({ memoryProcesses: procs }),
  setAllProcesses: (procs) => set({ allProcesses: procs, allProcessesLoading: false }),
  setAllProcessesLoading: (val) => set({ allProcessesLoading: val })
}))
