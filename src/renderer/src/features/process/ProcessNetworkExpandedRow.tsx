import { useEffect, useState } from 'react'
import type { PortInfo } from '@shared/types'
import { peerLabel } from './peerLabel'

function countryToFlag(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2) return ''
  return String.fromCodePoint(...iso2.toUpperCase().split('').map((character) => 0x1f1e6 - 65 + character.charCodeAt(0)))
}

export function ProcessNetworkExpandedRow({ pid }: { pid: number }) {
  const [ports, setPorts] = useState<PortInfo[] | null>(null)
  const [hostnames, setHostnames] = useState<Record<string, string | null>>({})
  const [countries, setCountries] = useState<Record<string, string | null>>({})
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void (async () => {
    const result = await window.systemScope.getNetworkPorts()
    if (!result.ok) { setError(result.error?.message ?? 'Unable to fetch port information.'); return }
    const filtered = (result.data as PortInfo[]).filter((port) => port.pid === pid)
    setPorts(filtered)
    const peerIps = [...new Set(filtered.map((port) => port.peerAddress).filter((ip) => ip && ip !== '*'))]
    if (peerIps.length === 0) return
    const [dnsResult, countryResult] = await Promise.all([
      window.systemScope.resolveHostnames(peerIps), window.systemScope.resolveCountries(peerIps)
    ])
    if (dnsResult.ok && dnsResult.data) setHostnames(dnsResult.data as Record<string, string | null>)
    if (countryResult.ok && countryResult.data) setCountries(countryResult.data as Record<string, string | null>)
  })() }, [pid])

  if (error || ports === null || ports.length === 0) {
    const text = error ?? (ports === null ? 'Loading ports...' : 'No ports found for this process.')
    return <tr><td colSpan={6} style={{ padding: '8px 12px', fontSize: '12px', color: error ? 'var(--accent-red)' : 'var(--text-secondary)' }}>{text}</td></tr>
  }
  return <tr><td colSpan={6} style={{ padding: '8px 12px 12px', background: 'var(--bg-subtle, var(--bg-card))' }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{ports.map((port, index) => <span key={index} style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', padding: '2px 6px', borderRadius: 'var(--radius-sm, 4px)', background: 'var(--bg-tag, var(--border))', color: 'var(--text-secondary)' }}>
      {port.protocol} {port.localAddress}:{port.localPort} → {peerLabel(port.peerAddress, hostnames[port.peerAddress] ?? null)}{countries[port.peerAddress] ? <span style={{ fontFamily: '"Twemoji Country Flags", var(--font-mono, monospace)' }}> {countryToFlag(countries[port.peerAddress])} {countries[port.peerAddress]}</span> : null}:{port.peerPort} [{port.state}]
    </span>)}</div>
  </td></tr>
}
