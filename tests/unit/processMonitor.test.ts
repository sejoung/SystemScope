import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Systeminformation } from 'systeminformation'

const processes = vi.hoisted(() => vi.fn<() => Promise<Systeminformation.ProcessesData>>())
const networkConnections = vi.hoisted(() => vi.fn<() => Promise<Systeminformation.NetworkConnectionsData[]>>())

vi.mock('systeminformation', () => ({
  default: {
    processes,
    networkConnections
  }
}))

describe('processMonitor.getNetworkPorts', () => {
  beforeEach(() => {
    processes.mockReset()
    networkConnections.mockReset()
  })

  it('should normalize, filter, and sort network ports', async () => {
    networkConnections.mockResolvedValue([
      {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '8080',
        peerAddress: '',
        peerPort: '*',
        state: 'LISTEN',
        pid: 200,
        process: '/Applications/Code.app'
      },
      {
        protocol: 'tcp',
        localAddress: '0.0.0.0',
        localPort: '3000',
        peerAddress: '10.0.0.5',
        peerPort: '443',
        state: 'ESTABLISHED',
        pid: 100,
        process: '/usr/bin/node'
      },
      {
        protocol: 'tcp',
        localAddress: '0.0.0.0',
        localPort: '9000',
        peerAddress: '',
        peerPort: '',
        state: 'LISTEN',
        pid: 0,
        process: 'ignored'
      },
      {
        protocol: 'udp',
        localAddress: '',
        localPort: '',
        peerAddress: '',
        peerPort: '',
        state: 'UNKNOWN',
        pid: 321,
        process: ''
      }
    ] as unknown as Systeminformation.NetworkConnectionsData[])

    const { getNetworkPorts } = await import('../../src/main/services/process/processMonitor')
    const ports = await getNetworkPorts()

    expect(ports).toHaveLength(2)
    expect(ports.map((port) => port.localPortNum)).toEqual([3000, 8080])
    expect(ports[0]).toMatchObject({
      protocol: 'tcp',
      localAddress: '0.0.0.0',
      localPort: '3000',
      peerAddress: '10.0.0.5',
      peerPort: '443',
      state: 'ESTABLISHED',
      pid: 100,
      process: 'node',
      localPortNum: 3000
    })
    expect(ports[1].process).toBe('Code')
  })

  it('should normalize Windows executable paths to a display name', async () => {
    networkConnections.mockResolvedValue([
      {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '5173',
        peerAddress: '',
        peerPort: '*',
        state: 'LISTEN',
        pid: 1200,
        process: 'C:\\Program Files\\nodejs\\node.exe'
      }
    ] as unknown as Systeminformation.NetworkConnectionsData[])

    const { getNetworkPorts } = await import('../../src/main/services/process/processMonitor')
    const ports = await getNetworkPorts()

    expect(ports).toHaveLength(1)
    expect(ports[0].process).toBe('node')
  })
})

describe('processMonitor process caching', () => {
  beforeEach(() => {
    // Reset the module so processMonitor's module-level process cache starts cold.
    // Without this, whichever caching test ran first leaves a warm cache and the
    // next one sees a cached result (0 si.processes calls) — an order-dependent
    // failure that surfaced only under certain test orderings (e.g. on CI).
    vi.resetModules()
    processes.mockReset()
  })

  it('should dedupe concurrent process snapshots and avoid mutating cached order', async () => {
    const sampleList = [
      { pid: 1, name: 'alpha', cpu: 10, mem: 20, memRss: 200, command: 'alpha' },
      { pid: 2, name: 'beta', cpu: 90, mem: 5, memRss: 100, command: 'beta' },
      { pid: 3, name: 'gamma', cpu: 30, mem: 40, memRss: 300, command: 'gamma' }
    ]

    let resolveProcesses: ((value: Systeminformation.ProcessesData) => void) | null = null
    processes.mockImplementation(() => new Promise<Systeminformation.ProcessesData>((resolve) => {
      resolveProcesses = resolve
    }))

    const { getAllProcesses, getProcessSnapshot, getTopCpuProcesses, getTopMemoryProcesses } = await import('../../src/main/services/process/processMonitor')

    const pending = Promise.all([
      getAllProcesses(),
      getTopCpuProcesses(2),
      getTopMemoryProcesses(2),
      getProcessSnapshot(2)
    ])

    expect(processes).toHaveBeenCalledTimes(1)
    resolveProcesses!({
      all: sampleList.length,
      running: sampleList.length,
      blocked: 0,
      sleeping: 0,
      unknown: 0,
      list: sampleList
    } as Systeminformation.ProcessesData)

    const [all, topCpu, topMemory, snapshot] = await pending
    expect(topCpu.map((entry) => entry.pid)).toEqual([2, 3])
    expect(topMemory.map((entry) => entry.pid)).toEqual([3, 1])
    expect(all.map((entry) => entry.pid)).toEqual([2, 3, 1])
    expect(snapshot.topCpuProcesses.map((entry) => entry.pid)).toEqual([2, 3])
    expect(snapshot.topMemoryProcesses.map((entry) => entry.pid)).toEqual([3, 1])
  })

  it('populates ppid, parentName, and transitive descendantCount', async () => {
    // tree: 100 (zsh) → 200 (npm) → 300 (node) → 400 (esbuild)
    //                                          ↘ 401 (esbuild-worker)
    const list = [
      { pid: 100, parentPid: 1, name: 'zsh', cpu: 1, mem: 5, memRss: 50, command: 'zsh' },
      { pid: 200, parentPid: 100, name: 'npm', cpu: 2, mem: 10, memRss: 100, command: 'npm run dev' },
      { pid: 300, parentPid: 200, name: 'node', cpu: 5, mem: 20, memRss: 200, command: 'node vite' },
      { pid: 400, parentPid: 300, name: 'esbuild', cpu: 80, mem: 30, memRss: 300, command: 'esbuild' },
      { pid: 401, parentPid: 300, name: 'esbuild', cpu: 1, mem: 5, memRss: 50, command: 'esbuild-worker' }
    ]
    processes.mockResolvedValue({
      all: list.length,
      running: list.length,
      blocked: 0,
      sleeping: 0,
      unknown: 0,
      list
    } as Systeminformation.ProcessesData)

    const { getAllProcesses } = await import('../../src/main/services/process/processMonitor')
    const all = await getAllProcesses()
    const byPid = new Map(all.map((p) => [p.pid, p]))

    expect(byPid.get(400)?.descendantCount).toBe(0) // leaf
    expect(byPid.get(401)?.descendantCount).toBe(0) // leaf
    expect(byPid.get(300)?.descendantCount).toBe(2) // node owns esbuild + worker
    expect(byPid.get(200)?.descendantCount).toBe(3) // npm owns node + 2 leaves
    expect(byPid.get(100)?.descendantCount).toBe(4) // zsh owns whole subtree

    expect(byPid.get(400)?.ppid).toBe(300)
    expect(byPid.get(400)?.parentName).toBe('node')
    expect(byPid.get(100)?.parentName).toBeNull() // ppid <= 1, treated as system root
  })
})
