import type { ProcessNetworkSnapshot, ProcessNetworkUsage } from '@shared/types'
import { runExternalCommand } from './externalCommand'
import si from 'systeminformation'

export interface NettopRow {
  pid: number
  name: string
  totalRxBytes: number
  totalTxBytes: number
}

export function parseNettopOutput(stdout: string): NettopRow[] {
  const rows: NettopRow[] = []
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    // nettop output may be whitespace- or comma-separated depending on flags;
    // normalize commas to whitespace before tokenizing.
    const tokens = line.replace(/,/g, ' ').split(/\s+/).filter(Boolean)
    if (tokens.length < 3) continue

    const txStr = tokens[tokens.length - 1]
    const rxStr = tokens[tokens.length - 2]
    const rx = Number(rxStr)
    const tx = Number(txStr)
    if (!Number.isFinite(rx) || !Number.isFinite(tx)) continue

    // Drop the leading `time` token; everything between time and the two byte
    // counters is the name.pid (which itself may contain spaces).
    const middle = tokens.slice(1, tokens.length - 2).join(' ')
    const lastDot = middle.lastIndexOf('.')
    if (lastDot < 0) continue
    const name = middle.slice(0, lastDot)
    const pid = Number(middle.slice(lastDot + 1))
    if (!Number.isInteger(pid) || pid <= 0 || !name) continue

    rows.push({ pid, name, totalRxBytes: rx, totalTxBytes: tx })
  }
  return rows
}

interface CacheEntry {
  rxBytes: number
  txBytes: number
  capturedAt: number
}

const cache = new Map<number, CacheEntry>()
let lastCapturedAt: number | null = null

export function __resetCacheForTests(): void {
  cache.clear()
  lastCapturedAt = null
}

export function computeSnapshot(rows: NettopRow[], capturedAt: number): ProcessNetworkSnapshot {
  const intervalSec =
    lastCapturedAt !== null && capturedAt > lastCapturedAt
      ? (capturedAt - lastCapturedAt) / 1000
      : null

  const seen = new Set<number>()
  const processes: ProcessNetworkUsage[] = rows.map((row) => {
    seen.add(row.pid)
    const prev = cache.get(row.pid)

    let rxBps: number | null = null
    let txBps: number | null = null
    if (prev && intervalSec && intervalSec > 0) {
      const dRx = row.totalRxBytes - prev.rxBytes
      const dTx = row.totalTxBytes - prev.txBytes
      if (dRx >= 0 && dTx >= 0) {
        rxBps = dRx / intervalSec
        txBps = dTx / intervalSec
      }
    }

    cache.set(row.pid, {
      rxBytes: row.totalRxBytes,
      txBytes: row.totalTxBytes,
      capturedAt,
    })

    return {
      pid: row.pid,
      name: row.name,
      rxBps,
      txBps,
      totalRxBytes: row.totalRxBytes,
      totalTxBytes: row.totalTxBytes,
    }
  })

  for (const pid of cache.keys()) {
    if (!seen.has(pid)) cache.delete(pid)
  }
  lastCapturedAt = capturedAt

  return { supported: true, capturedAt, intervalSec, processes }
}

const NETTOP_ARGS = ['-P', '-x', '-J', 'bytes_in,bytes_out', '-l', '1']

function basenameWithoutExt(processPath: string | undefined, pid: number): string {
  if (!processPath) return `PID ${pid}`
  // Handle both windows and posix separators
  const parts = processPath.split(/[\\/]/)
  const last = parts[parts.length - 1] || processPath
  return last.replace(/\.exe$/i, '').replace(/\.app$/i, '')
}

async function collectFromNetworkConnections(): Promise<ProcessNetworkSnapshot> {
  const conns = await si.networkConnections()
  const byPid = new Map<number, ProcessNetworkUsage>()
  for (const c of conns) {
    if (!c.pid || c.pid <= 0) continue
    const existing = byPid.get(c.pid)
    if (existing) continue  // we only need one entry per pid; counts are derived elsewhere
    byPid.set(c.pid, {
      pid: c.pid,
      name: basenameWithoutExt(c.process, c.pid),
      rxBps: null,
      txBps: null,
      totalRxBytes: null,
      totalTxBytes: null,
    })
  }
  return {
    supported: true,
    capturedAt: Date.now(),
    intervalSec: null,
    processes: Array.from(byPid.values()),
  }
}

export async function getProcessNetworkUsage(): Promise<ProcessNetworkSnapshot> {
  if (process.platform === 'darwin') {
    const { stdout } = await runExternalCommand('nettop', NETTOP_ARGS, { windowsHide: true })
    const rows = parseNettopOutput(stdout)
    return computeSnapshot(rows, Date.now())
  }
  if (process.platform === 'win32') {
    return collectFromNetworkConnections()
  }
  return { supported: false, capturedAt: Date.now(), intervalSec: null, processes: [] }
}
