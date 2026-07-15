import { useEffect, useMemo, useState } from 'react'
import type { ProcessNetworkSnapshot, ProcessNetworkUsage } from '@shared/types'
import { useI18n } from '../../../i18n/useI18n'
import { StatusMessage } from '../../../components/ui/StatusMessage'
import { usePidNetworkHistory } from './usePidNetworkHistory'
import { formatBps, ProcessNetworkTable, type NetworkSortKey } from './ProcessNetworkTable'

const NETWORK_POLL_INTERVAL_MS = 2_000

function nullLastDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

interface DerivedNetworkRows {
  processes: ProcessNetworkUsage[]
  totalRx: number | null
  totalTx: number | null
}

function deriveNetworkRows(
  snapshot: ProcessNetworkSnapshot,
  sortKey: NetworkSortKey,
  search: string,
  activeOnly: boolean,
): DerivedNetworkRows {
  const needle = search.trim().toLowerCase()
  const hasBaseline = snapshot.intervalSec !== null
  const processes: ProcessNetworkUsage[] = []
  let totalRx = 0
  let totalTx = 0

  for (const processUsage of snapshot.processes) {
    totalRx += processUsage.rxBps ?? 0
    totalTx += processUsage.txBps ?? 0
    if (activeOnly && (processUsage.rxBps ?? 0) === 0 && (processUsage.txBps ?? 0) === 0) continue
    if (needle && !processUsage.name.toLowerCase().includes(needle) && !String(processUsage.pid).includes(needle)) continue
    processes.push(processUsage)
  }
  processes.sort((left, right) => nullLastDesc(left[sortKey], right[sortKey]))
  return { processes, totalRx: hasBaseline ? totalRx : null, totalTx: hasBaseline ? totalTx : null }
}

export function ProcessNetworkPanel() {
  const { tk } = useI18n()
  const [snapshot, setSnapshot] = useState<ProcessNetworkSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<NetworkSortKey>('rxBps')
  const [expandedPid, setExpandedPid] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)

  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const fetchData = async (): Promise<void> => {
      try {
        const result = await window.systemScope.getNetworkUsage()
        if (!mounted) return
        if (result.ok && result.data) {
          setSnapshot(result.data as ProcessNetworkSnapshot)
          setError(null)
        } else if (!result.ok) {
          setError(result.error?.message ?? 'Unable to fetch network usage.')
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to fetch network usage.')
        }
      } finally {
        if (mounted) timer = setTimeout(() => { void fetchData() }, NETWORK_POLL_INTERVAL_MS)
      }
    }
    void fetchData()
    return () => {
      mounted = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  const history = usePidNetworkHistory(snapshot)
  const derived = useMemo(
    () => snapshot ? deriveNetworkRows(snapshot, sortKey, search, activeOnly) : null,
    [snapshot, sortKey, search, activeOnly],
  )

  if (snapshot && !snapshot.supported) {
    return <StatusMessage message={tk('process.network_usage.unsupported')} tone="info" />
  }
  if (error) return <StatusMessage message={error} tone="error" />
  if (!snapshot || !derived) return null

  return (
    <div>
      <div style={titleStyle}>{tk('process.network_usage.title')}</div>
      <div style={summaryStyle}>
        <NetworkTotal label={tk('process.network_usage.total_download')} value={derived.totalRx} marker="↓" color="var(--accent-blue, #3b82f6)" />
        <NetworkTotal label={tk('process.network_usage.total_upload')} value={derived.totalTx} marker="↑" color="var(--accent-green, #10b981)" />
      </div>
      <div style={filterStyle}>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={tk('process.network_usage.search_placeholder')}
          style={searchStyle}
        />
        <label style={activeOnlyStyle}>
          <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />
          {tk('process.network_usage.active_only')}
        </label>
        <span style={countStyle}>
          {tk('process.network_usage.row_count', { count: derived.processes.length, total: snapshot.processes.length })}
        </span>
      </div>
      <ProcessNetworkTable
        processes={derived.processes}
        history={history}
        sortKey={sortKey}
        onSort={setSortKey}
        expandedPid={expandedPid}
        onExpand={setExpandedPid}
        tk={tk}
      />
    </div>
  )
}

function NetworkTotal({ label, value, marker, color }: { label: string; value: number | null; marker: string; color: string }) {
  return (
    <div style={totalStyle}>
      <span style={{ color }}>{marker}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{label}</span>
      <span>{value === null ? '—' : formatBps(value)}</span>
    </div>
  )
}

const titleStyle = { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }
const summaryStyle = { display: 'flex', gap: '8px', marginBottom: '12px' }
const totalStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: 'var(--radius-sm, 4px)', background: 'var(--bg-tag, var(--border))', fontSize: '12px', color: 'var(--text-secondary)' }
const filterStyle = { display: 'flex', gap: '12px', alignItems: 'center', margin: '8px 0 12px' }
const searchStyle = { flex: '0 0 220px', padding: '6px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', background: 'var(--bg-input, var(--bg-card))', color: 'var(--text-primary)' }
const activeOnlyStyle = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }
const countStyle = { fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }
