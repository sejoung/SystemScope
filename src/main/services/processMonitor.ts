import si from 'systeminformation'
import path from 'path'
import type { ProcessInfo, PortInfo } from '@shared/types'

// si.processes() 중복 호출 방지를 위한 TTL 캐시 (500ms)
const PROCESS_CACHE_TTL = 500
let cachedProcesses: { data: si.Systeminformation.ProcessesData; timestamp: number } | null = null

async function getCachedProcesses(): Promise<si.Systeminformation.ProcessesData> {
  if (cachedProcesses && Date.now() - cachedProcesses.timestamp < PROCESS_CACHE_TTL) {
    return cachedProcesses.data
  }
  const data = await si.processes()
  cachedProcesses = { data, timestamp: Date.now() }
  return data
}

export async function getTopCpuProcesses(limit: number = 10): Promise<ProcessInfo[]> {
  const data = await getCachedProcesses()
  return data.list
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, limit)
    .map(toProcessInfo)
}

export async function getTopMemoryProcesses(limit: number = 10): Promise<ProcessInfo[]> {
  const data = await getCachedProcesses()
  return data.list
    .sort((a, b) => b.mem - a.mem)
    .slice(0, limit)
    .map(toProcessInfo)
}

export async function getAllProcesses(): Promise<ProcessInfo[]> {
  const data = await getCachedProcesses()
  return data.list
    .filter((p) => p.cpu > 0 || p.memRss > 0)
    .sort((a, b) => b.cpu - a.cpu)
    .map(toProcessInfo)
}

export async function getProcessByPid(pid: number): Promise<ProcessInfo | null> {
  const data = await getCachedProcesses()
  const found = data.list.find((processInfo) => processInfo.pid === pid)
  return found ? toProcessInfo(found) : null
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
        process: getProcessDisplayName(c.process, c.pid),
        localPortNum
      }
    })
    .sort((a, b) => a.localPortNum - b.localPortNum)
}

function getProcessDisplayName(processPath: string | undefined, pid: number): string {
  if (!processPath) return `PID ${pid}`

  const normalized = processPath.replace(/[\\/]+/g, path.sep)
  const baseName = path.basename(normalized)
  if (!baseName) return processPath

  return baseName.replace(/\.app$/i, '').replace(/\.exe$/i, '')
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
