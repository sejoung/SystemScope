import si from 'systeminformation'
import type { ProcessInfo } from '@shared/types'

export async function getTopCpuProcesses(limit: number = 10): Promise<ProcessInfo[]> {
  const data = await si.processes()
  return data.list
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, limit)
    .map(toProcessInfo)
}

export async function getTopMemoryProcesses(limit: number = 10): Promise<ProcessInfo[]> {
  const data = await si.processes()
  return data.list
    .sort((a, b) => b.mem - a.mem)
    .slice(0, limit)
    .map(toProcessInfo)
}

export async function getAllProcesses(): Promise<ProcessInfo[]> {
  const data = await si.processes()
  return data.list
    .filter((p) => p.cpu > 0 || p.memRss > 0)
    .sort((a, b) => b.cpu - a.cpu)
    .map(toProcessInfo)
}

function toProcessInfo(p: si.Systeminformation.ProcessesProcessData): ProcessInfo {
  return {
    pid: p.pid,
    name: p.name,
    cpu: Math.round(p.cpu * 100) / 100,
    memory: Math.round(p.mem * 100) / 100,
    memoryBytes: p.memRss,
    command: p.command
  }
}
