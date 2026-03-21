import { create } from 'zustand'
import type { ProcessInfo } from '@shared/types'

interface ProcessState {
  cpuProcesses: ProcessInfo[]
  memoryProcesses: ProcessInfo[]
  setCpuProcesses: (procs: ProcessInfo[]) => void
  setMemoryProcesses: (procs: ProcessInfo[]) => void
}

export const useProcessStore = create<ProcessState>((set) => ({
  cpuProcesses: [],
  memoryProcesses: [],

  setCpuProcesses: (procs) => set({ cpuProcesses: procs }),
  setMemoryProcesses: (procs) => set({ memoryProcesses: procs })
}))
