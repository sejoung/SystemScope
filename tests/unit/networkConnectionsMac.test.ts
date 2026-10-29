import { describe, expect, it, vi } from 'vitest'
import { parseMacNetworkConnections, parseMacLsofConnections, getMacNetworkConnections } from '../../src/main/services/process/networkConnections.mac'
import { runExternalCommand } from '../../src/main/services/core/externalCommand'

vi.mock('../../src/main/services/core/externalCommand', () => ({ runExternalCommand: vi.fn(), isExternalCommandError: (error: unknown) => error instanceof Error && 'kind' in error }))
vi.mock('../../src/main/services/core/logging', () => ({ logDebug: vi.fn() }))

const header = 'Proto Recv-Q Send-Q Local Address Foreign Address (state) rxbytes txbytes rhiwat shiwat process:pid state options gencnt flags flags1 usecnt rtncnt fltrs'

describe('macOS network connections', () => {
  it('reads TCP, UDP and UDP46 owners with spaces and full IPv6 endpoints', () => {
    const rows = parseMacNetworkConnections(`Active Internet connections (including servers)
${header}
tcp4 0 0 127.0.0.1.3000 *.* LISTEN 0 0 131072 131072 node:123 00100 0 0 0 0 1 0 0
tcp6 0 0 fe80::1234%en0.12345 2606:4700::1111.443 ESTABLISHED 10 20 131072 131072 Google Chrome He:456 00100 0 0 0 0 1 0 0
udp46 0 0 *.5353 *.* 10 20 131072 131072 mDNSResponder:267 00100 0 0 0 0 1 0 0
`)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ pid: 123, process: 'node', state: 'LISTEN', localPort: '3000' })
    expect(rows[1]).toMatchObject({ pid: 456, process: 'Google Chrome He', localAddress: 'fe80::1234%en0', peerAddress: '2606:4700::1111', peerPort: '443' })
    expect(rows[2]).toMatchObject({ protocol: 'udp46', pid: 267, state: 'UNKNOWN', localAddress: '*', localPort: '5353' })
  })

  it('also reads older macOS output with a separate pid column', () => {
    expect(parseMacNetworkConnections(`Proto Recv-Q Send-Q Local Address Foreign Address (state) rhiwat shiwat pid epid
tcp4 0 0 *.8080 *.* LISTEN 131072 131072 123 0
udp4 0 0 *.5353 *.* 131072 131072 456 0
`).map((row) => row.pid)).toEqual([123, 456])
  })

  it('handles an empty connection list and rejects an incompatible header', () => {
    expect(parseMacNetworkConnections(header)).toEqual([])
    expect(() => parseMacNetworkConnections('permission denied')).toThrow('Unrecognized')
  })

  it('uses a bounded command and propagates failures instead of hanging', async () => {
    vi.mocked(runExternalCommand).mockRejectedValue(new Error('permission denied'))
    await expect(getMacNetworkConnections()).rejects.toThrow('permission denied')
    expect(runExternalCommand).toHaveBeenCalledWith('/usr/sbin/netstat', ['-anvl'], expect.objectContaining({ timeout: 5_000 }))
  })

  it('falls back when GUI-launched netstat omits all Internet connections', async () => {
    vi.mocked(runExternalCommand)
      .mockResolvedValueOnce({ stdout: 'Active Multipath Internet connections\nProto/ID Flags Local Address Foreign Address (state)\nActive LOCAL (UNIX) domain sockets\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'p123\ncnode\nf10\ntIPv6\nPTCP\nn[::1]:3000\nTST=LISTEN\n', stderr: '' })
    expect(await getMacNetworkConnections()).toEqual([
      { pid: 123, process: 'node', protocol: 'tcp6', localAddress: '::1', localPort: '3000', peerAddress: '', peerPort: '*', state: 'LISTEN' },
    ])
  })

  it('keeps lsof file state separate across connections and processes', () => {
    const rows = parseMacLsofConnections('p123\ncHelper Name\nf10\ntIPv4\nPTCP\nn127.0.0.1:3000\nTST=LISTEN\nf11\ntIPv6\nPUDP\nn[fe80::1%en0]:5353->[ff02::fb]:5353\np456\ncother\nf1\ntIPv4\nPTCP\nn*:80\nTST=LISTEN\n')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toMatchObject({ pid: 123, process: 'Helper Name', protocol: 'udp6', localAddress: 'fe80::1%en0', peerAddress: 'ff02::fb', state: 'UNKNOWN' })
    expect(rows[2]).toMatchObject({ pid: 456, process: 'other', localAddress: '*', localPort: '80' })
  })

  it('treats lsof exit 1 with no matching files as an empty snapshot', async () => {
    vi.mocked(runExternalCommand)
      .mockResolvedValueOnce({ stdout: header, stderr: '' })
      .mockRejectedValueOnce(Object.assign(new Error('no files'), { kind: 'execution_failed', stdout: '', stderr: '', cause: { code: 1 } }))
    expect(await getMacNetworkConnections()).toEqual([])
  })
})
