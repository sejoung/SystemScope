import { useState, useMemo } from 'react'
import { Accordion } from '../../components/Accordion'
import { useToast } from '../../components/Toast'
import { usePortFinderStore } from '../../stores/usePortFinderStore'
import type { PortInfo, ProcessKillResult } from '@shared/types'

export function PortFinder() {
  const showToast = useToast((s) => s.show)
  const { ports, loading, scanned, stateFilter, setStateFilter, fetchPorts } = usePortFinderStore()
  const [search, setSearch] = useState('')
  const [searchScope, setSearchScope] = useState<'local' | 'remote' | 'all'>('local')

  // 1단계: 검색어 필터 (scope 적용)
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return ports
    const q = search.toLowerCase()
    return ports.filter((p) => {
      if (p.process.toLowerCase().includes(q) || p.pid.toString().includes(q)) return true
      if (searchScope === 'local') {
        return p.localPort.toString().includes(q) || p.localAddress.toLowerCase().includes(q)
      }
      if (searchScope === 'remote') {
        return p.peerPort.toString().includes(q) || p.peerAddress.toLowerCase().includes(q)
      }
      return p.localPort.toString().includes(q) || p.localAddress.toLowerCase().includes(q) ||
        p.peerPort.toString().includes(q) || p.peerAddress.toLowerCase().includes(q)
    })
  }, [ports, search, searchScope])

  // 2단계: 상태 필터 (검색 결과 기준 카운트)
  const filtered = useMemo(() => {
    if (stateFilter === 'LISTEN') return searchFiltered.filter((p) => p.state === 'LISTEN')
    if (stateFilter === 'ESTABLISHED') return searchFiltered.filter((p) => p.state === 'ESTABLISHED')
    if (stateFilter === 'other') return searchFiltered.filter((p) => p.state !== 'LISTEN' && p.state !== 'ESTABLISHED')
    return searchFiltered
  }, [searchFiltered, stateFilter])

  const listenCount = searchFiltered.filter((p) => p.state === 'LISTEN').length

  const handleKill = async (portInfo: PortInfo) => {
    const remote = formatEndpoint(portInfo.peerAddress, portInfo.peerPort)
    const res = await window.systemScope.killProcess({
      pid: portInfo.pid,
      name: portInfo.process,
      command: `${portInfo.protocol.toUpperCase()} ${portInfo.localAddress}:${portInfo.localPort} -> ${remote}`,
      reason: 'Activity > Ports'
    })
    if (!res.ok) {
      showToast(res.error?.message ?? '프로세스를 종료하지 못했습니다.')
      return
    }

    const result = res.data as ProcessKillResult
    if (result.cancelled) return
    if (result.killed) {
      showToast(`"${result.name}" (PID ${result.pid}) 종료 요청을 보냈습니다.`)
      await fetchPorts()
    }
  }

  return (
    <Accordion
      title="Port Finder"
      badge={scanned ? `${listenCount} listening` : undefined}
      badgeColor="var(--accent-cyan)"
      defaultOpen
      forceOpen={scanned && filtered.length > 0}
      actions={
        <>
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '2px', background: 'var(--bg-primary)', borderRadius: '6px', padding: '2px' }}>
            {(['local', 'remote', 'all'] as const).map((s) => (
              <button key={s} onClick={() => setSearchScope(s)} style={{
                padding: '3px 8px', fontSize: '10px', fontWeight: 600, border: 'none', borderRadius: '4px',
                background: searchScope === s ? 'var(--accent-cyan)' : 'transparent',
                color: searchScope === s ? 'var(--text-on-accent)' : 'var(--text-muted)',
                cursor: 'pointer', textTransform: 'capitalize'
              }}>{s}</button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder={searchScope === 'local' ? 'Local port, address, process...' : searchScope === 'remote' ? 'Remote port, address, process...' : 'Port, address, process...'}
            style={searchStyle}
          />
          <button onClick={() => fetchPorts()} disabled={loading} style={btnStyle}>
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
              All ({searchFiltered.length})
            </FilterBtn>
            <FilterBtn active={stateFilter === 'LISTEN'} onClick={() => setStateFilter('LISTEN')}>
              Listening ({listenCount})
            </FilterBtn>
            <FilterBtn active={stateFilter === 'ESTABLISHED'} onClick={() => setStateFilter('ESTABLISHED')}>
              Established ({searchFiltered.filter((p) => p.state === 'ESTABLISHED').length})
            </FilterBtn>
            <FilterBtn active={stateFilter === 'other'} onClick={() => setStateFilter('other')}>
              Other ({searchFiltered.filter((p) => p.state !== 'LISTEN' && p.state !== 'ESTABLISHED').length})
            </FilterBtn>
          </div>

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
                    <th style={{ ...thStyle, textAlign: 'center', width: '92px' }}>Action</th>
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
                        {formatEndpoint(p.peerAddress, p.peerPort)}
                      </td>
                      <td style={tdStyle}>
                        <StateBadge state={p.state} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => void handleKill(p)} style={killBtnStyle}>Kill PID</button>
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

// ─── Helpers ───

function formatEndpoint(addr: string, port: string): string {
  const hasAddr = addr && addr !== '*' && addr !== ''
  const hasPort = port && port !== '*' && port !== '0' && port !== ''
  if (hasAddr && hasPort) return `${addr}:${port}`
  if (hasAddr) return addr
  if (hasPort) return `:${port}`
  return '-'
}

const STATE_STYLES: Record<string, { bg: string; color: string; tip: string }> = {
  LISTEN:       { bg: 'var(--success-soft)', color: 'var(--accent-green)', tip: '포트에서 연결 대기 중' },
  ESTABLISHED:  { bg: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)', tip: '연결이 수립된 상태' },
  SYN_SENT:     { bg: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', tip: '연결 요청을 보낸 상태' },
  SYN_RECEIVED: { bg: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', tip: '연결 요청을 받은 상태' },
  SYN_RECV:     { bg: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', tip: '연결 요청을 받은 상태' },
  FIN_WAIT_1:   { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '연결 종료를 시작함' },
  FIN_WAIT_2:   { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '상대의 FIN을 기다리는 중' },
  FIN_WAIT1:    { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '연결 종료를 시작함' },
  FIN_WAIT2:    { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '상대의 FIN을 기다리는 중' },
  TIME_WAIT:    { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '종료 후 잔여 패킷 대기' },
  CLOSING:      { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '양쪽이 동시에 종료를 시작' },
  LAST_ACK:     { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '마지막 ACK를 기다리는 중' },
  CLOSE_WAIT:   { bg: 'var(--alert-red-soft)', color: 'var(--accent-red)', tip: '상대가 연결을 종료함 — close() 필요' },
  CLOSED:       { bg: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)', tip: '연결 종료됨' },
  UNKNOWN:      { bg: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)', tip: 'UDP 또는 상태 불명' },
}

function StateBadge({ state }: { state: string }) {
  const s = STATE_STYLES[state] ?? { bg: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)', tip: state }
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }} title={s.tip}>
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

// ─── Styles ───

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
