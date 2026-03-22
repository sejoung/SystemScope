import { beforeEach, describe, expect, it, vi } from 'vitest'

const networkConnections = vi.hoisted(() => vi.fn())

vi.mock('systeminformation', () => ({
  default: {
    networkConnections
  }
}))

describe('processMonitor.getNetworkPorts', () => {
  beforeEach(() => {
    networkConnections.mockReset()
  })

  it('should normalize, filter, and sort network ports', async () => {
    networkConnections.mockResolvedValue([
      {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: 8080,
        peerAddress: '',
        peerPort: '*',
        state: 'LISTEN',
        pid: 200,
        process: '/Applications/Code.app'
      },
      {
        protocol: 'tcp',
        localAddress: '0.0.0.0',
        localPort: 3000,
        peerAddress: '10.0.0.5',
        peerPort: 443,
        state: 'ESTABLISHED',
        pid: 100,
        process: '/usr/bin/node'
      },
      {
        protocol: 'tcp',
        localAddress: '0.0.0.0',
        localPort: 9000,
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
    ])

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
})
