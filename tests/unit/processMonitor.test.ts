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

    const { getNetworkPorts } = await import('../../src/main/services/processMonitor')
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

    const { getNetworkPorts } = await import('../../src/main/services/processMonitor')
    const ports = await getNetworkPorts()

    expect(ports).toHaveLength(1)
    expect(ports[0].process).toBe('node')
  })
})

describe('processMonitor process caching', () => {
  beforeEach(() => {
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

    const { getAllProcesses, getTopCpuProcesses, getTopMemoryProcesses } = await import('../../src/main/services/processMonitor')

    const pending = Promise.all([
      getAllProcesses(),
      getTopCpuProcesses(2),
      getTopMemoryProcesses(2)
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

    const [all, topCpu, topMemory] = await pending
    expect(topCpu.map((entry) => entry.pid)).toEqual([2, 3])
    expect(topMemory.map((entry) => entry.pid)).toEqual([3, 1])
    expect(all.map((entry) => entry.pid)).toEqual([2, 3, 1])
  })
})
