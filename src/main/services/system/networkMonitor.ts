import si from 'systeminformation'
import { networkInterfaces, platform } from 'node:os'
import type { NetworkInfo } from '@shared/types'
import { runExternalCommand } from '@main/services/core/externalCommand'
import { logDebug } from '@main/services/core/logging'

interface InterfaceCounters {
  iface: string
  rx: number
  tx: number
}

let previousCounters = new Map<string, InterfaceCounters>()
let previousCapturedAt = 0

// macOS repeats each interface's counters for every IPv4/IPv6 address. Only
// the Link row is a NIC total; column offsets vary when no MAC is printed.
export function parseMacNetworkCounters(stdout: string): InterfaceCounters[] {
  const lines = stdout.trim().split('\n')
  const header = lines.shift()?.trim().split(/\s+/) ?? []
  const rxOffset = header.length - header.indexOf('Ibytes')
  const txOffset = header.length - header.indexOf('Obytes')
  if (!header.includes('Ibytes') || !header.includes('Obytes')) {
    throw new Error('Unrecognized netstat interface header')
  }
  const rows: InterfaceCounters[] = []
  for (const line of lines) {
    const fields = line.trim().split(/\s+/)
    if (!/^<Link#\d+>$/.test(fields[2] ?? '') || fields[0].endsWith('*')) continue
    const rx = Number(fields.at(-rxOffset))
    const tx = Number(fields.at(-txOffset))
    if (!Number.isSafeInteger(rx) || !Number.isSafeInteger(tx) || rx < 0 || tx < 0) continue
    rows.push({ iface: fields[0], rx, tx })
  }
  return rows
}

function sumAvailable(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0)
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) * 100) / 100 : null
}

async function getMacNetworkInfo(): Promise<NetworkInfo> {
  const { stdout } = await runExternalCommand('/usr/sbin/netstat', ['-ibn'], {
    timeout: 5_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { LC_ALL: 'C' },
  })
  const addresses = networkInterfaces()
  const external = parseMacNetworkCounters(stdout).filter((row) =>
    addresses[row.iface]?.some((address) => !address.internal)
    && !/^(awdl|llw|nan)\d+$/.test(row.iface))
  // VPN counters contain the same packets as their physical transport. Prefer
  // physical interfaces, retaining tunnels when they are the only available ones.
  const physical = external.filter((row) => !/^utun\d+$/.test(row.iface))
  const source = physical.length ? physical : external
  const capturedAt = Date.now()
  const intervalSec = previousCapturedAt > 0 ? (capturedAt - previousCapturedAt) / 1000 : 0
  const rates = source.map((row) => {
    const previous = previousCounters.get(row.iface)
    return {
      rx: previous && intervalSec > 0 && row.rx >= previous.rx ? (row.rx - previous.rx) / intervalSec : null,
      tx: previous && intervalSec > 0 && row.tx >= previous.tx ? (row.tx - previous.tx) / intervalSec : null,
    }
  })
  previousCounters = new Map(source.map((row) => [row.iface, row]))
  previousCapturedAt = capturedAt
  return {
    downloadBytesPerSecond: sumAvailable(rates.map((rate) => rate.rx)),
    uploadBytesPerSecond: sumAvailable(rates.map((rate) => rate.tx)),
    totalDownloadedBytes: sumAvailable(source.map((row) => row.rx)),
    totalUploadedBytes: sumAvailable(source.map((row) => row.tx)),
    interfaces: source.map((row) => row.iface),
  }
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  try {
    if (platform() === 'darwin') return await getMacNetworkInfo()
    const stats = await si.networkStats('*')
    const activeStats = stats.filter((item) => item.operstate === 'up')
    const source = activeStats.length > 0 ? activeStats : stats.filter((item) => item.operstate !== 'down')
    return {
      downloadBytesPerSecond: sumAvailable(source.map((item) => item.rx_sec)),
      uploadBytesPerSecond: sumAvailable(source.map((item) => item.tx_sec)),
      totalDownloadedBytes: sumAvailable(source.map((item) => item.rx_bytes)),
      totalUploadedBytes: sumAvailable(source.map((item) => item.tx_bytes)),
      interfaces: source.map((item) => item.iface).filter(Boolean),
    }
  } catch (error) {
    logDebug('system-monitor', 'Network information is unavailable', { error })
    return {
      downloadBytesPerSecond: null,
      uploadBytesPerSecond: null,
      totalDownloadedBytes: null,
      totalUploadedBytes: null,
      interfaces: [],
    }
  }
}
