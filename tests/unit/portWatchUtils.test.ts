import { describe, expect, it } from 'vitest'
import type { PortInfo } from '../../src/shared/types'
import { formatPortAddress, matchWatchPorts, parseWatchPattern } from '../../src/renderer/src/features/process/portWatchUtils'

const SAMPLE_PORTS: PortInfo[] = [
  {
    protocol: 'tcp',
    localAddress: '127.0.0.1',
    localPort: '3000',
    peerAddress: '10.0.0.1',
    peerPort: '443',
    state: 'ESTABLISHED',
    pid: 101,
    process: 'node',
    localPortNum: 3000
  },
  {
    protocol: 'tcp',
    localAddress: '0.0.0.0',
    localPort: '5432',
    peerAddress: '',
    peerPort: '*',
    state: 'LISTEN',
    pid: 102,
    process: 'postgres',
    localPortNum: 5432
  }
]

describe('portWatchUtils', () => {
  it('should parse watch patterns by type', () => {
    expect(parseWatchPattern('3000', 'local', () => 'id-port')).toEqual({
      id: 'id-port',
      pattern: '3000',
      type: 'port',
      scope: 'local'
    })
    expect(parseWatchPattern('10.0.0.1', 'remote', () => 'id-ip')).toEqual({
      id: 'id-ip',
      pattern: '10.0.0.1',
      type: 'ip',
      scope: 'remote'
    })
    expect(parseWatchPattern('10.0.0.1:443', 'all', () => 'id-ip-port')).toEqual({
      id: 'id-ip-port',
      pattern: '10.0.0.1:443',
      type: 'ip:port',
      scope: 'all'
    })
    expect(parseWatchPattern('   ', 'all', () => 'id-empty')).toBeNull()
  })

  it('should match ports according to watch type and scope', () => {
    expect(matchWatchPorts({ pattern: '3000', type: 'port', scope: 'local' }, SAMPLE_PORTS)).toHaveLength(1)
    expect(matchWatchPorts({ pattern: '443', type: 'port', scope: 'remote' }, SAMPLE_PORTS)).toHaveLength(1)
    expect(matchWatchPorts({ pattern: '10.0.0.1', type: 'ip', scope: 'remote' }, SAMPLE_PORTS)).toHaveLength(1)
    expect(matchWatchPorts({ pattern: '10.0.0.1:443', type: 'ip:port', scope: 'all' }, SAMPLE_PORTS)).toHaveLength(1)
    expect(matchWatchPorts({ pattern: '9999', type: 'port', scope: 'all' }, SAMPLE_PORTS)).toHaveLength(0)
  })

  it('should format addresses safely', () => {
    expect(formatPortAddress('127.0.0.1', '3000')).toBe('127.0.0.1:3000')
    expect(formatPortAddress('127.0.0.1', '*')).toBe('127.0.0.1')
    expect(formatPortAddress('', '443')).toBe(':443')
    expect(formatPortAddress('', '')).toBe('*')
  })
})
