import { create } from 'zustand'
import type { ProcessInfo } from '@shared/types'

interface ProcessState {
  cpuProcesses: ProcessInfo[]
  memoryProcesses: ProcessInfo[]
  allProcesses: ProcessInfo[]
  setCpuProcesses: (procs: ProcessInfo[]) => void
  setMemoryProcesses: (procs: ProcessInfo[]) => void
  setAllProcesses: (procs: ProcessInfo[]) => void
}

export const useProcessStore = create<ProcessState>((set) => ({
  cpuProcesses: [],
  memoryProcesses: [],
  allProcesses: [],
  setCpuProcesses: (procs) => set({ cpuProcesses: procs }),
  setMemoryProcesses: (procs) => set({ memoryProcesses: procs }),
  setAllProcesses: (procs) => set({ allProcesses: procs })
}))
