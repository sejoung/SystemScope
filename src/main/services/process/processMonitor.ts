import si from 'systeminformation'
import path from 'node:path'
import type { ProcessInfo, PortInfo, ProcessSnapshot } from '@shared/types'

// si.processes() 중복 호출 방지를 위한 TTL 캐시 (500ms)
const PROCESS_CACHE_TTL = 500
let cachedProcesses: { data: si.Systeminformation.ProcessesData; timestamp: number } | null = null
let pendingProcesses: Promise<si.Systeminformation.ProcessesData> | null = null

async function getCachedProcesses(): Promise<si.Systeminformation.ProcessesData> {
  if (cachedProcesses && Date.now() - cachedProcesses.timestamp < PROCESS_CACHE_TTL) {
    return cachedProcesses.data
  }
  if (pendingProcesses) {
    return pendingProcesses
  }

  pendingProcesses = si.processes()
    .then((data) => {
      cachedProcesses = { data, timestamp: Date.now() }
      return data
    })
    .finally(() => {
      pendingProcesses = null
    })

  return pendingProcesses
}

function buildPidNameMap(
  list: si.Systeminformation.ProcessesProcessData[]
): Map<number, string> {
  const map = new Map<number, string>()
  for (const p of list) map.set(p.pid, p.name)
  return map
}

// Builds a pid → transitive descendant count map. Uses memoized DFS over the parent graph.
function buildDescendantCounts(
  list: si.Systeminformation.ProcessesProcessData[]
): Map<number, number> {
  const childrenByParent = new Map<number, number[]>()
  for (const p of list) {
    const arr = childrenByParent.get(p.parentPid)
    if (arr) arr.push(p.pid)
    else childrenByParent.set(p.parentPid, [p.pid])
  }

  const counts = new Map<number, number>()
  const visiting = new Set<number>()
  const compute = (pid: number): number => {
    const cached = counts.get(pid)
    if (cached !== undefined) return cached
    if (visiting.has(pid)) return 0 // defensive: cycle guard
    visiting.add(pid)
    const children = childrenByParent.get(pid) ?? []
    let total = children.length
    for (const child of children) total += compute(child)
    visiting.delete(pid)
    counts.set(pid, total)
    return total
  }
  for (const p of list) compute(p.pid)
  return counts
}

interface ProcessContext {
  pidToName: Map<number, string>
  descendantCounts: Map<number, number>
}

function selectTopProcesses(
  processes: ProcessInfo[],
  limit: number,
  score: (processInfo: ProcessInfo) => number
): ProcessInfo[] {
  if (limit <= 0) return []
  const selected: ProcessInfo[] = []
  for (const processInfo of processes) {
    let low = 0
    let high = selected.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (score(selected[middle]) >= score(processInfo)) low = middle + 1
      else high = middle
    }
    selected.splice(low, 0, processInfo)
    if (selected.length > limit) selected.pop()
  }
  return selected
}

function buildProcessContext(
  list: si.Systeminformation.ProcessesProcessData[]
): ProcessContext {
  return {
    pidToName: buildPidNameMap(list),
    descendantCounts: buildDescendantCounts(list)
  }
}

export async function getTopCpuProcesses(limit: number = 10): Promise<ProcessInfo[]> {
  const data = await getCachedProcesses()
  const ctx = buildProcessContext(data.list)
  return [...data.list]
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, limit)
    .map((p) => toProcessInfo(p, ctx))
}

export async function getTopMemoryProcesses(limit: number = 10): Promise<ProcessInfo[]> {
  const data = await getCachedProcesses()
  const ctx = buildProcessContext(data.list)
  return [...data.list]
    .sort((a, b) => b.mem - a.mem)
    .slice(0, limit)
    .map((p) => toProcessInfo(p, ctx))
}

export async function getAllProcesses(): Promise<ProcessInfo[]> {
  const data = await getCachedProcesses()
  const ctx = buildProcessContext(data.list)
  return [...data.list]
    .filter((p) => p.cpu > 0 || p.memRss > 0)
    .sort((a, b) => b.cpu - a.cpu)
    .map((p) => toProcessInfo(p, ctx))
}

export async function getProcessSnapshot(limit: number = 10): Promise<ProcessSnapshot> {
  const data = await getCachedProcesses()
  const ctx = buildProcessContext(data.list)
  const mapped = data.list
    .filter((processInfo) => processInfo.cpu > 0 || processInfo.memRss > 0)
    .map((p) => toProcessInfo(p, ctx))

  const topCpuProcesses = selectTopProcesses(mapped, limit, (processInfo) => processInfo.cpu)
  const topMemoryProcesses = selectTopProcesses(mapped, limit, (processInfo) => processInfo.memory)

  return {
    allProcesses: mapped,
    topCpuProcesses,
    topMemoryProcesses
  }
}

export async function getProcessByPid(pid: number): Promise<ProcessInfo | null> {
  const data = await getCachedProcesses()
  const found = data.list.find((processInfo) => processInfo.pid === pid)
  if (!found) return null
  return toProcessInfo(found, buildProcessContext(data.list))
}

// Returns descendants of `rootPid` ordered shallowest-first. Excludes rootPid itself.
export async function getProcessDescendants(rootPid: number): Promise<ProcessInfo[]> {
  const data = await getCachedProcesses()
  const ctx = buildProcessContext(data.list)
  const byParent = new Map<number, si.Systeminformation.ProcessesProcessData[]>()
  for (const p of data.list) {
    const list = byParent.get(p.parentPid)
    if (list) list.push(p)
    else byParent.set(p.parentPid, [p])
  }

  const result: ProcessInfo[] = []
  const queue: number[] = [rootPid]
  const seen = new Set<number>([rootPid])
  while (queue.length > 0) {
    const pid = queue.shift() as number
    const children = byParent.get(pid) ?? []
    for (const child of children) {
      if (seen.has(child.pid)) continue
      seen.add(child.pid)
      result.push(toProcessInfo(child, ctx))
      queue.push(child.pid)
    }
  }
  return result
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

function toProcessInfo(
  p: si.Systeminformation.ProcessesProcessData,
  ctx: ProcessContext
): ProcessInfo {
  const ppid = p.parentPid
  return {
    pid: p.pid,
    ppid,
    parentName: ppid > 1 ? ctx.pidToName.get(ppid) ?? null : null,
    descendantCount: ctx.descendantCounts.get(p.pid) ?? 0,
    name: p.name,
    cpu: Math.round(p.cpu * 100) / 100,
    memory: Math.round(p.mem * 100) / 100,
    memoryBytes: p.memRss,
    command: p.command
  }
}
