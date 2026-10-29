import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Systeminformation } from 'systeminformation'

const mocks = vi.hoisted(() => ({ command: vi.fn(), interfaces: vi.fn(), stats: vi.fn(), platform: vi.fn() }))
vi.mock('node:os', () => ({ networkInterfaces: mocks.interfaces, platform: mocks.platform }))
vi.mock('systeminformation', () => ({ default: { networkStats: mocks.stats } }))
vi.mock('../../src/main/services/core/externalCommand', () => ({ runExternalCommand: mocks.command }))
vi.mock('../../src/main/services/core/logging', () => ({ logDebug: vi.fn() }))

const header = 'Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll'
const output = (rx: number, tx: number) => `${header}
lo0 16384 <Link#1> 10 0 999999999 10 0 999999999 0
en0 1500 <Link#2> aa:bb:cc:dd:ee:ff 10 0 ${rx} 10 0 ${tx} 0
en0 1500 192.168.0 192.168.0.2 10 0 ${rx} 10 0 ${tx} 0
utun0 1500 <Link#3> 10 0 ${rx} 10 0 ${tx} 0
awdl0 1500 <Link#4> aa:bb:cc:dd:ee:ff 10 0 100000 10 0 100000 0
`

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
  mocks.platform.mockReturnValue('darwin')
  mocks.interfaces.mockReturnValue({
    lo0: [{ internal: true }], en0: [{ internal: false }],
    utun0: [{ internal: false }], awdl0: [{ internal: false }],
  })
})
afterEach(() => vi.useRealTimers())

describe('network monitoring', () => {
  it('parses NIC totals once, including interfaces without a MAC column', async () => {
    const { parseMacNetworkCounters } = await import('../../src/main/services/system/networkMonitor')
    expect(parseMacNetworkCounters(output(1000, 500))).toEqual([
      { iface: 'lo0', rx: 999999999, tx: 999999999 },
      { iface: 'en0', rx: 1000, tx: 500 },
      { iface: 'utun0', rx: 1000, tx: 500 },
      { iface: 'awdl0', rx: 100000, tx: 100000 },
    ])
  })

  it('computes rates without counting loopback, VPN or duplicate address rows', async () => {
    const { getNetworkInfo } = await import('../../src/main/services/system/networkMonitor')
    mocks.command.mockResolvedValueOnce({ stdout: output(1000, 500) })
    expect(await getNetworkInfo()).toMatchObject({ downloadBytesPerSecond: null, interfaces: ['en0'], totalDownloadedBytes: 1000 })
    vi.setSystemTime(1_002_000)
    mocks.command.mockResolvedValueOnce({ stdout: output(1400, 600) })
    expect(await getNetworkInfo()).toMatchObject({ downloadBytesPerSecond: 200, uploadBytesPerSecond: 50, totalUploadedBytes: 600 })
  })

  it('starts a new baseline after counters reset or an interface reconnects', async () => {
    const { getNetworkInfo } = await import('../../src/main/services/system/networkMonitor')
    mocks.command.mockResolvedValueOnce({ stdout: output(1000, 500) })
    await getNetworkInfo()
    vi.setSystemTime(1_002_000)
    mocks.command.mockResolvedValueOnce({ stdout: output(10, 20) })
    expect((await getNetworkInfo()).downloadBytesPerSecond).toBeNull()
    mocks.interfaces.mockReturnValue({ lo0: [{ internal: true }] })
    mocks.command.mockResolvedValueOnce({ stdout: output(20, 30) })
    expect(await getNetworkInfo()).toMatchObject({ interfaces: [], totalDownloadedBytes: null })
    mocks.interfaces.mockReturnValue({ en0: [{ internal: false }] })
    mocks.command.mockResolvedValueOnce({ stdout: output(30, 40) })
    expect((await getNetworkInfo()).downloadBytesPerSecond).toBeNull()
  })

  it('retains tunnel counters if there is no physical transport in the snapshot', async () => {
    mocks.interfaces.mockReturnValue({ utun0: [{ internal: false }] })
    mocks.command.mockResolvedValueOnce({ stdout: output(100, 50) })
    const { getNetworkInfo } = await import('../../src/main/services/system/networkMonitor')
    expect(await getNetworkInfo()).toMatchObject({ interfaces: ['utun0'], totalDownloadedBytes: 100 })
  })

  it('degrades to unavailable and recovers after command errors', async () => {
    const { getNetworkInfo } = await import('../../src/main/services/system/networkMonitor')
    mocks.command.mockRejectedValueOnce(new Error('permission denied'))
    expect(await getNetworkInfo()).toMatchObject({ interfaces: [], downloadBytesPerSecond: null })
    mocks.command.mockResolvedValueOnce({ stdout: output(100, 50) })
    expect((await getNetworkInfo()).totalDownloadedBytes).toBe(100)
    expect(mocks.command).toHaveBeenCalledWith('/usr/sbin/netstat', ['-ibn'], expect.objectContaining({ timeout: 5_000 }))
  })

  it('ignores negative unavailable sentinels on other platforms', async () => {
    mocks.platform.mockReturnValue('win32')
    mocks.stats.mockResolvedValue([
      { iface: 'Ethernet', operstate: 'up', rx_sec: 100, tx_sec: 20, rx_bytes: 1000, tx_bytes: 200 },
      { iface: 'Virtual', operstate: 'up', rx_sec: -1, tx_sec: -1, rx_bytes: -1, tx_bytes: -1 },
    ] as Systeminformation.NetworkStatsData[])
    const { getNetworkInfo } = await import('../../src/main/services/system/networkMonitor')
    expect(await getNetworkInfo()).toMatchObject({ downloadBytesPerSecond: 100, uploadBytesPerSecond: 20, totalDownloadedBytes: 1000 })
  })
})
