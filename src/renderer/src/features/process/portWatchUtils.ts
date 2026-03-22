import type { PortInfo } from '@shared/types'
import type { WatchEntry } from '../../stores/usePortWatchStore'

export function parseWatchPattern(
  input: string,
  scope: WatchEntry['scope'],
  createId: () => string = () => `watch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
): WatchEntry | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(trimmed)) {
    return { id: createId(), pattern: trimmed, type: 'ip:port', scope }
  }
  if (/^\d+$/.test(trimmed)) {
    return { id: createId(), pattern: trimmed, type: 'port', scope }
  }
  return { id: createId(), pattern: trimmed, type: 'ip', scope }
}

export function matchWatchPorts(watch: Pick<WatchEntry, 'pattern' | 'type' | 'scope'>, ports: PortInfo[]): PortInfo[] {
  const matchLocal = watch.scope === 'local' || watch.scope === 'all'
  const matchRemote = watch.scope === 'remote' || watch.scope === 'all'

  switch (watch.type) {
    case 'port':
      return ports.filter((p) =>
        (matchLocal && p.localPort === watch.pattern) ||
        (matchRemote && p.peerPort === watch.pattern)
      )
    case 'ip':
      return ports.filter((p) =>
        (matchLocal && p.localAddress.includes(watch.pattern)) ||
        (matchRemote && p.peerAddress.includes(watch.pattern))
      )
    case 'ip:port': {
      const [ip, port] = watch.pattern.split(':')
      return ports.filter((p) =>
        (matchLocal && p.localAddress.includes(ip) && p.localPort === port) ||
        (matchRemote && p.peerAddress.includes(ip) && p.peerPort === port)
      )
    }
    default:
      return []
  }
}

export function formatPortAddress(addr: string, port: string): string {
  const hasAddr = addr && addr !== '*' && addr !== ''
  const hasPort = port && port !== '*' && port !== '0' && port !== ''
  if (hasAddr && hasPort) return `${addr}:${port}`
  if (hasAddr) return addr
  if (hasPort) return `:${port}`
  return '*'
}
