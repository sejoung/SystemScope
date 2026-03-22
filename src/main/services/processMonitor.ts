import si from 'systeminformation'
import type { ProcessInfo, PortInfo } from '@shared/types'

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

export async function getNetworkPorts(): Promise<PortInfo[]> {
  const connections = await si.networkConnections()
  return connections
    .filter((c) => c.localPort && c.pid > 0)
    .map((c) => {
      const localPortNum = toNum(c.localPort)
      return {
        protocol: c.protocol,
        localAddress: String(c.localAddress ?? ''),
        localPort: String(c.localPort ?? '*'),
        peerAddress: String(c.peerAddress ?? ''),
        peerPort: String(c.peerPort ?? '*'),
        state: c.state,
        pid: c.pid,
        process: c.process ? c.process.split('/').pop()?.replace('.app', '') ?? c.process : `PID ${c.pid}`,
        localPortNum
      }
    })
    .sort((a, b) => a.localPortNum - b.localPortNum)
}

function toNum(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === '' || v === '*') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
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
