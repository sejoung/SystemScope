import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { parseNettopOutput, computeSnapshot, __resetCacheForTests, getProcessNetworkUsage } from '../../src/main/services/processNetworkMonitor'

vi.mock('../../src/main/services/externalCommand', () => ({
  runExternalCommand: vi.fn(),
}))

vi.mock('systeminformation', () => ({
  default: {
    networkConnections: vi.fn(),
  },
  networkConnections: vi.fn(),
}))

import { runExternalCommand } from '../../src/main/services/externalCommand'
import si from 'systeminformation'

const FIXTURE = `time                                                                                 bytes_in       bytes_out
12:56:05.461338 mDNSResponder.686                                                  1206434923        87387400
12:56:05.461343 com.apple.Safar.1838                                                    28917           26107
12:56:05.461344 Slack Helper.2821                                                       56716           44817
12:56:05.461345 launchd.1                                                                   0               0
`

describe('parseNettopOutput', () => {
  it('parses bytes_in / bytes_out and splits name.pid on the last dot', () => {
    const rows = parseNettopOutput(FIXTURE)
    expect(rows).toEqual([
      { pid: 686, name: 'mDNSResponder', totalRxBytes: 1206434923, totalTxBytes: 87387400 },
      { pid: 1838, name: 'com.apple.Safar', totalRxBytes: 28917, totalTxBytes: 26107 },
      { pid: 2821, name: 'Slack Helper', totalRxBytes: 56716, totalTxBytes: 44817 },
      { pid: 1, name: 'launchd', totalRxBytes: 0, totalTxBytes: 0 },
    ])
  })

  it('skips the header row and any row whose trailing token is not numeric', () => {
    const input = `time bytes_in bytes_out\n\n   \n12:00:00.000 foo.42 1 2\nnonsense line\n`
    const rows = parseNettopOutput(input)
    expect(rows).toEqual([{ pid: 42, name: 'foo', totalRxBytes: 1, totalTxBytes: 2 }])
  })

  it('skips rows whose name.pid token has no numeric pid suffix', () => {
    const input = `12:00:00.000 weird-no-dot 1 2\n12:00:00.000 ok.7 3 4\n`
    const rows = parseNettopOutput(input)
    expect(rows).toEqual([{ pid: 7, name: 'ok', totalRxBytes: 3, totalTxBytes: 4 }])
  })

  it('handles comma-separated (CSV) nettop output', () => {
    const input = `time,           ,                                                            bytes_in,       bytes_out,
14:26:56.395451,launchd.1,                                                                 0,              0,
14:26:56.395456,apsd.593,                                                               6643,          22478,
`
    const rows = parseNettopOutput(input)
    expect(rows).toEqual([
      { pid: 1, name: 'launchd', totalRxBytes: 0, totalTxBytes: 0 },
      { pid: 593, name: 'apsd', totalRxBytes: 6643, totalTxBytes: 22478 },
    ])
  })
})

describe('computeSnapshot', () => {
  beforeEach(() => __resetCacheForTests())

  const t0 = 1_000_000_000_000

  it('returns null bps on the first call (no baseline)', () => {
    const snap = computeSnapshot(
      [{ pid: 1, name: 'a', totalRxBytes: 100, totalTxBytes: 50 }],
      t0
    )
    expect(snap.supported).toBe(true)
    expect(snap.intervalSec).toBeNull()
    expect(snap.processes).toEqual([
      { pid: 1, name: 'a', rxBps: null, txBps: null, totalRxBytes: 100, totalTxBytes: 50 },
    ])
  })

  it('computes bps from the delta between two samples', () => {
    computeSnapshot([{ pid: 1, name: 'a', totalRxBytes: 100, totalTxBytes: 50 }], t0)
    const snap = computeSnapshot(
      [{ pid: 1, name: 'a', totalRxBytes: 300, totalTxBytes: 150 }],
      t0 + 2000
    )
    expect(snap.intervalSec).toBe(2)
    expect(snap.processes).toEqual([
      { pid: 1, name: 'a', rxBps: 100, txBps: 50, totalRxBytes: 300, totalTxBytes: 150 },
    ])
  })

  it('evicts PIDs that disappear from the new sample', () => {
    computeSnapshot(
      [
        { pid: 1, name: 'a', totalRxBytes: 100, totalTxBytes: 0 },
        { pid: 2, name: 'b', totalRxBytes: 200, totalTxBytes: 0 },
      ],
      t0
    )
    const snap = computeSnapshot(
      [{ pid: 1, name: 'a', totalRxBytes: 200, totalTxBytes: 0 }],
      t0 + 1000
    )
    expect(snap.processes.map((p) => p.pid)).toEqual([1])
    // Re-introducing pid 2 should be treated as a fresh baseline.
    const snap2 = computeSnapshot(
      [{ pid: 2, name: 'b', totalRxBytes: 500, totalTxBytes: 0 }],
      t0 + 2000
    )
    expect(snap2.processes).toEqual([
      { pid: 2, name: 'b', rxBps: null, txBps: null, totalRxBytes: 500, totalTxBytes: 0 },
    ])
  })

  it('returns null bps when the counter regresses (PID reuse / wrap)', () => {
    computeSnapshot([{ pid: 1, name: 'a', totalRxBytes: 1000, totalTxBytes: 1000 }], t0)
    const snap = computeSnapshot(
      [{ pid: 1, name: 'a', totalRxBytes: 50, totalTxBytes: 50 }],
      t0 + 1000
    )
    expect(snap.processes[0].rxBps).toBeNull()
    expect(snap.processes[0].txBps).toBeNull()
    // Next call should establish a new baseline against 50.
    const snap2 = computeSnapshot(
      [{ pid: 1, name: 'a', totalRxBytes: 150, totalTxBytes: 150 }],
      t0 + 2000
    )
    expect(snap2.processes[0].rxBps).toBe(100)
  })
})

describe('getProcessNetworkUsage', () => {
  const originalPlatform = process.platform

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    vi.mocked(runExternalCommand).mockReset()
    __resetCacheForTests()
  })

  it('returns { supported: false } on non-darwin / non-win32 (linux etc.)', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const snap = await getProcessNetworkUsage()
    expect(snap.supported).toBe(false)
    expect(snap.processes).toEqual([])
    expect(runExternalCommand).not.toHaveBeenCalled()
  })

  it('runs nettop with the expected args on darwin and returns parsed snapshot', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    vi.mocked(runExternalCommand).mockResolvedValueOnce({
      stdout: 'time bytes_in bytes_out\n12:00:00.000 foo.42 10 20\n',
      stderr: '',
    })
    const snap = await getProcessNetworkUsage()
    expect(runExternalCommand).toHaveBeenCalledWith(
      'nettop',
      ['-P', '-x', '-J', 'bytes_in,bytes_out', '-l', '1'],
      expect.any(Object)
    )
    expect(snap.supported).toBe(true)
    expect(snap.processes).toEqual([
      { pid: 42, name: 'foo', rxBps: null, txBps: null, totalRxBytes: 10, totalTxBytes: 20 },
    ])
  })
})

describe('getProcessNetworkUsage on win32', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    __resetCacheForTests()
    vi.mocked(si.networkConnections).mockReset()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('aggregates si.networkConnections() by pid into ProcessNetworkUsage with null bytes', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    vi.mocked(si.networkConnections).mockResolvedValueOnce([
      // chrome.exe with two connections
      { protocol: 'tcp', localAddress: '192.168.0.10', localPort: '50001', peerAddress: '142.250.80.46', peerPort: '443', state: 'ESTABLISHED', pid: 1234, process: 'C:\\Program Files\\Google\\Chrome\\chrome.exe' },
      { protocol: 'tcp', localAddress: '192.168.0.10', localPort: '50002', peerAddress: '142.250.80.47', peerPort: '443', state: 'ESTABLISHED', pid: 1234, process: 'C:\\Program Files\\Google\\Chrome\\chrome.exe' },
      // slack.exe with one
      { protocol: 'tcp', localAddress: '192.168.0.10', localPort: '50100', peerAddress: '13.107.42.14', peerPort: '443', state: 'ESTABLISHED', pid: 5678, process: 'slack.exe' },
      // entries with pid <= 0 should be skipped
      { protocol: 'tcp', localAddress: '0.0.0.0', localPort: '80', peerAddress: '0.0.0.0', peerPort: '0', state: 'LISTEN', pid: 0, process: '' },
    ] as unknown as si.Systeminformation.NetworkConnectionsData[])

    const snap = await getProcessNetworkUsage()
    expect(snap.supported).toBe(true)
    expect(snap.processes).toHaveLength(2)
    const chrome = snap.processes.find((p) => p.pid === 1234)!
    expect(chrome.name).toBe('chrome')
    expect(chrome.rxBps).toBeNull()
    expect(chrome.txBps).toBeNull()
    expect(chrome.totalRxBytes).toBeNull()
    expect(chrome.totalTxBytes).toBeNull()
    const slack = snap.processes.find((p) => p.pid === 5678)!
    expect(slack.name).toBe('slack')
  })

  it('returns empty processes array when there are no usable connections', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    vi.mocked(si.networkConnections).mockResolvedValueOnce([])
    const snap = await getProcessNetworkUsage()
    expect(snap.supported).toBe(true)
    expect(snap.processes).toEqual([])
  })
})
