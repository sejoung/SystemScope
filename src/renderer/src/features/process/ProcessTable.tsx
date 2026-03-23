import { useState, useMemo } from 'react'
import type { ProcessInfo, ProcessKillResult } from '@shared/types'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'
import { useToast } from '../../components/Toast'
import { useI18n } from '../../i18n/useI18n'

type SortField = 'cpu' | 'memory' | 'name' | 'pid'
type SortDir = 'asc' | 'desc'

interface ProcessTableProps {
  processes: ProcessInfo[]
}

export function ProcessTable({ processes }: ProcessTableProps) {
  const showToast = useToast((s) => s.show)
  const { tk } = useI18n()
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('cpu')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDir(field === 'name' ? 'asc' : 'desc')
    }
  }

  const filtered = useMemo(() => {
    let list = processes

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.pid.toString().includes(q) || p.command.toLowerCase().includes(q)
      )
    }

    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'cpu': cmp = a.cpu - b.cpu; break
        case 'memory': cmp = a.memoryBytes - b.memoryBytes; break
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'pid': cmp = a.pid - b.pid; break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return list
  }, [processes, search, sortField, sortDir])

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return ''
    return sortDir === 'desc' ? ' ▼' : ' ▲'
  }

  const handleKill = async (processInfo: ProcessInfo) => {
    const res = await window.systemScope.killProcess({
      pid: processInfo.pid,
      name: processInfo.name,
      command: processInfo.command,
      reason: 'Activity > Processes'
    })
    if (!res.ok) {
      showToast(res.error?.message ?? tk('process.table.kill_failed'))
      return
    }

    const result = res.data as ProcessKillResult
    if (result.cancelled) return
    if (result.killed) {
      showToast(tk('process.table.kill_sent', { name: result.name, pid: result.pid }))
    }
  }

  return (
    <Accordion
      title={tk('process.table.title', { count: filtered.length })}
      defaultOpen
      badge={processes.length > 0 ? `${processes.length}` : undefined}
      badgeColor="var(--text-muted)"
      actions={
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tk('process.table.search_placeholder')}
          onClick={(e) => e.stopPropagation()}
          style={searchStyle}
        />
      }
    >
      <div style={{ maxHeight: '500px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              <SortHeader field="pid" current={sortField} onClick={handleSort} width="60px">
                PID{sortIcon('pid')}
              </SortHeader>
              <SortHeader field="name" current={sortField} onClick={handleSort}>
                {tk('process.table.name')}{sortIcon('name')}
              </SortHeader>
              <SortHeader field="cpu" current={sortField} onClick={handleSort} width="80px" align="right">
                CPU %{sortIcon('cpu')}
              </SortHeader>
              <SortHeader field="memory" current={sortField} onClick={handleSort} width="90px" align="right">
                {tk('process.table.memory')}{sortIcon('memory')}
              </SortHeader>
              <th style={{ ...thStyle, textAlign: 'center', width: '92px' }}>{tk('process.table.action')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                  {search ? tk('process.table.empty_search', { query: search }) : tk('process.table.loading')}
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.pid} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>
                  {p.pid}
                </td>
                <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-primary)' }}>
                  <div>{p.name}</div>
                  {search && p.command && p.command !== p.name && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                      {p.command}
                    </div>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                  <span style={{
                    color: p.cpu > 80 ? 'var(--accent-red)' : p.cpu > 30 ? 'var(--accent-yellow)' : 'var(--text-primary)'
                  }}>
                    {p.cpu.toFixed(1)}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatBytes(p.memoryBytes)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <button onClick={() => void handleKill(p)} style={killBtnStyle}>{tk('process.table.kill')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Accordion>
  )
}

function SortHeader({ field, current, onClick, width, align, children }: {
  field: SortField
  current: SortField
  onClick: (field: SortField) => void
  width?: string
  align?: string
  children: React.ReactNode
}) {
  const isActive = current === field
  return (
    <th
      onClick={() => onClick(field)}
      style={{
        ...thStyle,
        textAlign: (align as React.CSSProperties['textAlign']) ?? 'left',
        width,
        cursor: 'pointer',
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        userSelect: 'none'
      }}
    >
      {children}
    </th>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 4px',
  fontWeight: 500,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

const tdStyle: React.CSSProperties = {
  padding: '5px 4px',
  color: 'var(--text-secondary)'
}

const searchStyle: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: '12px',
  width: '220px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  outline: 'none'
}

const killBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--accent-red)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}
