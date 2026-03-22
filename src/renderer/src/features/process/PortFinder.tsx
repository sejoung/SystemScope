import { useState, useMemo } from 'react'
import { Accordion } from '../../components/Accordion'
import type { PortInfo } from '@shared/types'

type StateFilter = 'all' | 'LISTEN' | 'ESTABLISHED' | 'other'

export function PortFinder() {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')

  const handleScan = async () => {
    setLoading(true)
    const res = await window.systemScope.getNetworkPorts()
    if (res.ok && res.data) setPorts(res.data as PortInfo[])
    setLoading(false)
    setScanned(true)
  }

  const filtered = useMemo(() => {
    let list = ports

    // State filter
    if (stateFilter === 'LISTEN') list = list.filter((p) => p.state === 'LISTEN')
    else if (stateFilter === 'ESTABLISHED') list = list.filter((p) => p.state === 'ESTABLISHED')
    else if (stateFilter === 'other') list = list.filter((p) => p.state !== 'LISTEN' && p.state !== 'ESTABLISHED')

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.localPort.toString().includes(q) ||
          p.process.toLowerCase().includes(q) ||
          p.pid.toString().includes(q) ||
          p.peerAddress.toLowerCase().includes(q) ||
          p.peerPort.toString().includes(q)
      )
    }

    return list
  }, [ports, search, stateFilter])

  const listenCount = ports.filter((p) => p.state === 'LISTEN').length

  return (
    <Accordion
      title="Port Finder"
      badge={scanned ? `${listenCount} listening` : undefined}
      badgeColor="var(--accent-cyan)"
      defaultOpen={false}
      forceOpen={scanned && filtered.length > 0}
      actions={
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Port, process, PID..."
            style={searchStyle}
          />
          <button onClick={handleScan} disabled={loading} style={btnStyle}>
            {loading ? 'Scanning...' : scanned ? 'Refresh' : 'Scan Ports'}
          </button>
        </>
      }
    >
      {!scanned ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0' }}>
          현재 사용 중인 네트워크 포트와 점유 프로세스를 조회합니다
        </div>
      ) : (
        <div>
          {/* State filter tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <FilterBtn active={stateFilter === 'all'} onClick={() => setStateFilter('all')}>
              All ({ports.length})
            </FilterBtn>
            <FilterBtn active={stateFilter === 'LISTEN'} onClick={() => setStateFilter('LISTEN')}>
              Listening ({ports.filter((p) => p.state === 'LISTEN').length})
            </FilterBtn>
            <FilterBtn active={stateFilter === 'ESTABLISHED'} onClick={() => setStateFilter('ESTABLISHED')}>
              Established ({ports.filter((p) => p.state === 'ESTABLISHED').length})
            </FilterBtn>
            <FilterBtn active={stateFilter === 'other'} onClick={() => setStateFilter('other')}>
              Other ({ports.filter((p) => p.state !== 'LISTEN' && p.state !== 'ESTABLISHED').length})
            </FilterBtn>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
              {search ? `"${search}" 검색 결과 없음` : '해당 상태의 포트가 없습니다'}
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <th style={thStyle}>Proto</th>
                    <th style={thStyle}>Local Port</th>
                    <th style={thStyle}>Process</th>
                    <th style={thStyle}>PID</th>
                    <th style={thStyle}>Remote</th>
                    <th style={thStyle}>State</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {p.protocol}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                        {p.localPort}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-primary)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.process}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {p.pid}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {p.peerAddress && p.peerPort ? `${p.peerAddress}:${p.peerPort}` : '-'}
                      </td>
                      <td style={tdStyle}>
                        <StateBadge state={p.state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Accordion>
  )
}

function StateBadge({ state }: { state: string }) {
  let bg = 'var(--bg-card-hover)'
  let color = 'var(--text-muted)'

  if (state === 'LISTEN') {
    bg = 'var(--success-soft)'
    color = 'var(--accent-green)'
  } else if (state === 'ESTABLISHED') {
    bg = 'rgba(59,130,246,0.15)'
    color = 'var(--accent-blue)'
  } else if (state === 'CLOSE_WAIT' || state === 'TIME_WAIT') {
    bg = 'var(--alert-yellow-soft)'
    color = 'var(--accent-yellow)'
  }

  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, padding: '2px 6px',
      borderRadius: '4px', background: bg, color, whiteSpace: 'nowrap'
    }}>
      {state}
    </span>
  )
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', fontSize: '11px', fontWeight: active ? 600 : 400,
      border: 'none', borderRadius: '5px',
      background: active ? 'var(--accent-cyan)' : 'var(--bg-card-hover)',
      color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)',
      cursor: 'pointer'
    }}>
      {children}
    </button>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 4px',
  color: 'var(--text-muted)', fontWeight: 500,
  fontSize: '11px', textTransform: 'uppercase',
  letterSpacing: '0.05em', whiteSpace: 'nowrap'
}

const tdStyle: React.CSSProperties = {
  padding: '5px 4px', color: 'var(--text-secondary)'
}

const searchStyle: React.CSSProperties = {
  padding: '5px 12px', fontSize: '12px', width: '180px',
  border: '1px solid var(--border)', borderRadius: '6px',
  background: 'var(--bg-primary)', color: 'var(--text-primary)',
  outline: 'none'
}

const btnStyle: React.CSSProperties = {
  padding: '5px 14px', fontSize: '12px', fontWeight: 600,
  border: 'none', borderRadius: '6px',
  background: 'var(--accent-cyan)', color: 'var(--text-on-accent)',
  cursor: 'pointer'
}
