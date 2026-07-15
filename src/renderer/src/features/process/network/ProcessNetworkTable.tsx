import { useCallback } from 'react'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import type { ProcessNetworkUsage } from '@shared/types'
import type { TranslateFn } from '@shared/i18n'
import type { PidHistory } from './usePidNetworkHistory'
import { Sparkline } from './Sparkline'
import { ProcessNetworkExpandedRow } from './ProcessNetworkExpandedRow'

export type NetworkSortKey = 'rxBps' | 'txBps' | 'totalRxBytes' | 'totalTxBytes'

const ROW_HEIGHT = 48
const MAX_LIST_HEIGHT = 520
const GRID_TEMPLATE = 'minmax(180px, 1.4fr) repeat(2, minmax(100px, .75fr)) minmax(100px, .8fr) repeat(2, minmax(110px, .85fr))'

interface Props {
  processes: ProcessNetworkUsage[]
  history: Map<number, PidHistory>
  sortKey: NetworkSortKey
  onSort: (key: NetworkSortKey) => void
  expandedPid: number | null
  onExpand: (pid: number | null) => void
  tk: TranslateFn
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatBps(bps: number | null): string {
  if (bps === null) return '—'
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  if (bps < 1024 * 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
  return `${(bps / (1024 * 1024 * 1024)).toFixed(2)} GB/s`
}

export function ProcessNetworkTable({ processes, history, sortKey, onSort, expandedPid, onExpand, tk }: Props) {
  const Row = useCallback(({ index, style }: RowComponentProps) => {
    const processUsage = processes[index]
    const expanded = processUsage.pid === expandedPid
    return (
      <div
        role="row"
        style={{ ...style, ...rowStyle, background: expanded ? 'var(--bg-subtle, var(--bg-card))' : undefined }}
        onClick={() => onExpand(expanded ? null : processUsage.pid)}
      >
        <div style={processCellStyle}>
          <span style={{ fontWeight: 500 }}>{processUsage.name}</span>
          <span style={pidStyle}>{processUsage.pid}</span>
        </div>
        <div style={cellStyle}>{formatBps(processUsage.rxBps)}</div>
        <div style={cellStyle}>{formatBps(processUsage.txBps)}</div>
        <div style={activityCellStyle}><Sparkline samples={history.get(processUsage.pid)?.samples ?? []} /></div>
        <div style={cellStyle}>{formatBytes(processUsage.totalRxBytes)}</div>
        <div style={cellStyle}>{formatBytes(processUsage.totalTxBytes)}</div>
      </div>
    )
  }, [expandedPid, history, onExpand, processes])

  const expandedProcess = expandedPid === null ? null : processes.find((entry) => entry.pid === expandedPid)
  const listHeight = Math.min(MAX_LIST_HEIGHT, processes.length * ROW_HEIGHT)

  return (
    <div style={{ overflowX: 'auto' }} role="table">
      <div role="row" style={headerRowStyle}>
        <div style={headerStyle}>{tk('process.network_usage.col.process')}</div>
        <SortHeader label={`↓ ${tk('process.network_usage.col.rxBps')}`} sortKey="rxBps" activeKey={sortKey} onSort={onSort} />
        <SortHeader label={`↑ ${tk('process.network_usage.col.txBps')}`} sortKey="txBps" activeKey={sortKey} onSort={onSort} />
        <div style={headerStyle}>{tk('process.network_usage.col.activity')}</div>
        <SortHeader label={tk('process.network_usage.col.totalRx')} sortKey="totalRxBytes" activeKey={sortKey} onSort={onSort} />
        <SortHeader label={tk('process.network_usage.col.totalTx')} sortKey="totalTxBytes" activeKey={sortKey} onSort={onSort} />
      </div>
      {processes.length > 0 && (
        <List
          rowComponent={Row}
          rowCount={processes.length}
          rowHeight={ROW_HEIGHT}
          rowProps={{}}
          overscanCount={8}
          style={{ height: listHeight, minWidth: 760, width: '100%' }}
        />
      )}
      {expandedProcess && <ProcessNetworkExpandedRow pid={expandedProcess.pid} />}
    </div>
  )
}

function SortHeader({ label, sortKey, activeKey, onSort }: { label: string; sortKey: NetworkSortKey; activeKey: NetworkSortKey; onSort: (key: NetworkSortKey) => void }) {
  const active = sortKey === activeKey
  return (
    <button type="button" onClick={() => onSort(sortKey)} style={{ ...sortHeaderStyle, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
      {label} {active ? '▼' : ''}
    </button>
  )
}

const headerRowStyle = { display: 'grid', gridTemplateColumns: GRID_TEMPLATE, minWidth: '760px', borderBottom: '1px solid var(--border)' }
const headerStyle = { padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'left' as const, whiteSpace: 'nowrap' as const }
const sortHeaderStyle = { ...headerStyle, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }
const rowStyle = { display: 'grid', gridTemplateColumns: GRID_TEMPLATE, alignItems: 'center', minWidth: '760px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }
const cellStyle = { padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)' }
const processCellStyle = { ...cellStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }
const activityCellStyle = { ...cellStyle, padding: '4px 12px' }
const pidStyle = { marginLeft: '6px', fontSize: '11px', color: 'var(--text-secondary)' }
