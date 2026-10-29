import type { Systeminformation } from 'systeminformation'
import { isExternalCommandError, runExternalCommand } from '@main/services/core/externalCommand'
import { logDebug } from '@main/services/core/logging'

export function parseMacNetworkConnections(stdout: string): Systeminformation.NetworkConnectionsData[] {
  const connections: Systeminformation.NetworkConnectionsData[] = []
  let pidColumn = -1
  let stateColumn = -1
  let hasProcessName = false
  let foundHeader = false
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (line.startsWith('Proto ')) {
      const header = line.replace(/Local Address|Foreign Address/g, (value) => value.replace(' ', '_')).split(/\s+/)
      hasProcessName = header.includes('process:pid')
      pidColumn = header.indexOf(hasProcessName ? 'process:pid' : 'pid')
      stateColumn = header.indexOf('(state)')
      if (pidColumn >= 0 && stateColumn >= 0) foundHeader = true
      continue
    }
    if (!/^(tcp|udp)\d*\s/.test(line) || pidColumn < 0) continue
    const fields = line.split(/\s+/)
    const hasState = fields[0].startsWith('tcp')
    const ownerColumn = pidColumn - (hasState ? 0 : 1)
    let pid: number
    let processName = ''
    if (hasProcessName) {
      // macOS 26/27 prints process:pid; process names can contain spaces.
      const ownerEnd = fields.findIndex((field, index) => index >= ownerColumn && /:\d+$/.test(field))
      if (ownerEnd < 0) continue
      const owner = fields.slice(ownerColumn, ownerEnd + 1).join(' ')
      const separator = owner.lastIndexOf(':')
      pid = Number(owner.slice(separator + 1))
      processName = owner.slice(0, separator)
    } else {
      pid = Number(fields[ownerColumn])
    }
    if (!Number.isSafeInteger(pid) || pid < 0) continue
    const local = splitEndpoint(fields[3])
    const peer = splitEndpoint(fields[4])
    if (!local || !peer) continue
    connections.push({
      protocol: fields[0],
      localAddress: local.address,
      localPort: local.port,
      peerAddress: peer.address,
      peerPort: peer.port,
      state: hasState ? fields[stateColumn] : 'UNKNOWN',
      pid,
      process: processName,
    })
  }
  if (!foundHeader) throw new Error('Unrecognized netstat connection header')
  return connections
}

function splitEndpoint(value: string | undefined): { address: string; port: string } | null {
  if (!value) return null
  const separator = value.lastIndexOf('.')
  if (separator < 0) return null
  const port = value.slice(separator + 1)
  if (port !== '*' && !/^\d+$/.test(port)) return null
  return { address: value.slice(0, separator), port }
}

export async function getMacNetworkConnections(): Promise<Systeminformation.NetworkConnectionsData[]> {
  const options = {
    timeout: 5_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { LC_ALL: 'C' },
  }
  try {
    const { stdout } = await runExternalCommand('/usr/sbin/netstat', ['-anvl'], options)
    const connections = parseMacNetworkConnections(stdout)
    if (connections.length > 0) return connections
  } catch (error) {
    logDebug('process-monitor', 'netstat connections unavailable, trying lsof', { error })
  }
  // On newer macOS, netstat can exit successfully while omitting TCP/UDP
  // entirely when launched from a GUI app. lsof uses a different query path.
  try {
    const { stdout } = await runExternalCommand('/usr/sbin/lsof', ['-nP', '-i', '-FpcftPnT', '+c', '0'], options)
    return parseMacLsofConnections(stdout)
  } catch (error) {
    if (isExternalCommandError(error)) {
      const partial = parseMacLsofConnections(error.stdout)
      if (partial.length > 0) return partial
      // lsof returns 1 when no files match, which is a valid empty snapshot.
      const exitCode = (error.cause as { code?: number } | undefined)?.code
      if (exitCode === 1 && !error.stdout.trim() && !error.stderr.trim()) return []
    }
    throw error
  }
}

export function parseMacLsofConnections(stdout: string): Systeminformation.NetworkConnectionsData[] {
  const connections: Systeminformation.NetworkConnectionsData[] = []
  let pid = 0
  let processName = ''
  let family = ''
  let protocol = ''
  let endpoint = ''
  let state = 'UNKNOWN'
  const flush = (): void => {
    if (pid <= 0 || !endpoint || !['TCP', 'UDP'].includes(protocol)) return
    const [localValue, peerValue] = endpoint.split('->')
    const local = splitLsofEndpoint(localValue)
    const peer = peerValue ? splitLsofEndpoint(peerValue) : { address: '', port: '*' }
    if (!local || !peer) return
    connections.push({
      pid, process: processName,
      protocol: `${protocol.toLowerCase()}${family === 'IPv6' ? '6' : '4'}`,
      localAddress: local.address, localPort: local.port,
      peerAddress: peer.address, peerPort: peer.port, state,
    })
  }
  for (const line of stdout.split('\n')) {
    const value = line.slice(1)
    if (line[0] === 'p' || line[0] === 'f') {
      flush()
      family = protocol = endpoint = ''
      state = 'UNKNOWN'
      if (line[0] === 'p') {
        pid = Number(value)
        if (!Number.isSafeInteger(pid)) pid = 0
        processName = ''
      }
    } else if (line[0] === 'c') processName = value
    else if (line[0] === 't') family = value
    else if (line[0] === 'P') protocol = value
    else if (line[0] === 'n') endpoint = value
    else if (line.startsWith('TST=')) state = line.slice(4)
  }
  flush()
  return connections
}

function splitLsofEndpoint(value: string): { address: string; port: string } | null {
  const separator = value.lastIndexOf(':')
  if (separator < 0) return null
  const port = value.slice(separator + 1)
  if (port !== '*' && !/^\d+$/.test(port)) return null
  return { address: value.slice(0, separator).replace(/^\[|\]$/g, ''), port }
}
