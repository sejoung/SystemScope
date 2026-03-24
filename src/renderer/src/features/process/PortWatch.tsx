import { useState, useCallback, useEffect } from 'react'
import { useInterval } from '../../hooks/useInterval'
import { useToast } from '../../components/Toast'
import { usePortWatchStore } from '../../stores/usePortWatchStore'
import { getStateStyle } from './portStateStyles'
import type { PortInfo } from '@shared/types'
import { formatPortAddress, matchWatchPorts, parseWatchPattern } from './portWatchUtils'
import { useI18n } from '../../i18n/useI18n'

const POLL_OPTIONS = [
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' }
]

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

const DISPLAY_LIMIT = 100

export function PortWatch() {
  const showToast = useToast((s) => s.show)
  const { tk } = useI18n()
  const {
    watches, statuses, history, monitoring, pollInterval, expandedWatch, watchFilters,
    addWatch: storeAddWatch, removeWatch, setStatuses, addHistory, clearHistory,
    setMonitoring, setPollInterval, toggleExpanded, setWatchFilter, setPrevMatched
  } = usePortWatchStore()

  const [input, setInput] = useState('')
  const [watchScope, setWatchScope] = useState<'local' | 'remote' | 'all'>('local')

  const handleAddWatch = () => {
    const entry = parseWatchPattern(input, watchScope)
    if (!entry) return
    if (watches.some((w) => w.pattern === entry.pattern)) {
      showToast(tk('process.port_watch.duplicate', { pattern: entry.pattern }))
      return
    }
    storeAddWatch(entry)
    setInput('')
  }

  const pollPorts = useCallback(async () => {
    if (watches.length === 0) return

    const res = await window.systemScope.getNetworkPorts()
    if (!res.ok || !res.data) return
    const ports = res.data as PortInfo[]
    const now = Date.now()
    const newStatuses = new Map<string, { id: string; matched: boolean; matches: PortInfo[]; lastChecked: number }>()
    const newHistory: { timestamp: number; watchId: string; pattern: string; event: 'connected' | 'disconnected'; process: string; detail: string }[] = []

    // store에서 직접 읽어 의존성 루프 방지
    const currentPrevMatched = usePortWatchStore.getState().prevMatched

    for (const watch of watches) {
      const matches = matchWatchPorts(watch, ports)
      const matched = matches.length > 0
      const prev = currentPrevMatched.get(watch.id)

      newStatuses.set(watch.id, { id: watch.id, matched, matches, lastChecked: now })

      if (prev !== undefined && prev !== matched) {
        const proc = matches[0]?.process ?? '-'
        const detail = matched
          ? matches.slice(0, 3).map((m) => `${formatPortAddress(m.localAddress, m.localPort)}→${formatPortAddress(m.peerAddress, m.peerPort)} (${m.state})`).join(', ')
          : ''

        newHistory.push({
          timestamp: now, watchId: watch.id, pattern: watch.pattern,
          event: matched ? 'connected' : 'disconnected', process: proc, detail
        })

        showToast(matched
          ? tk('process.port_watch.connected', { pattern: watch.pattern, process: proc })
          : tk('process.port_watch.disconnected', { pattern: watch.pattern }))
      }

      setPrevMatched(watch.id, matched)
    }

    setStatuses(newStatuses)
    if (newHistory.length > 0) addHistory(newHistory)
  }, [watches, showToast, setStatuses, addHistory, setPrevMatched])

  useEffect(() => {
    if (monitoring && watches.length > 0) pollPorts()
  }, [monitoring, watches.length, pollPorts])

  useInterval(monitoring && watches.length > 0 ? pollPorts : () => {}, pollInterval)

  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk('process.port_watch.title')}</span>
          {monitoring && watches.length > 0 && (
            <span style={badgeStyle}>{tk('process.port_watch.badge', { count: watches.length })}</span>
          )}
        </div>
      </div>
      {/* Input */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-primary)', borderRadius: '6px', padding: '2px' }}>
          {(['local', 'remote', 'all'] as const).map((s) => (
            <button key={s} onClick={() => setWatchScope(s)} style={{
              padding: '3px 8px', fontSize: '10px', fontWeight: 600, border: 'none', borderRadius: '4px',
              background: watchScope === s ? 'var(--accent-cyan)' : 'transparent',
              color: watchScope === s ? 'var(--text-on-accent)' : 'var(--text-muted)',
              cursor: 'pointer', textTransform: 'capitalize'
            }}>{s}</button>
          ))}
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddWatch() }}
          placeholder={watchScope === 'local' ? tk('process.port_watch.placeholder_local') : watchScope === 'remote' ? tk('process.port_watch.placeholder_remote') : tk('process.port_watch.placeholder_all')}
          style={inputStyle}
        />
        <button onClick={handleAddWatch} style={btnStyle}>{tk('process.port_watch.add')}</button>
        {watches.length > 0 && (
          <button
            onClick={() => setMonitoring(!monitoring)}
            style={{ ...btnStyle, background: monitoring ? 'var(--accent-red)' : 'var(--accent-green)' }}
          >
            {monitoring ? tk('common.pause') : tk('common.resume')}
          </button>
        )}
        {watches.length > 0 && (
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-primary)', borderRadius: '6px', padding: '2px' }}>
            {POLL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPollInterval(opt.value)}
                style={{
                  padding: '3px 8px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: '5px',
                  background: pollInterval === opt.value ? 'var(--accent-cyan)' : 'transparent',
                  color: pollInterval === opt.value ? 'var(--text-on-accent)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {monitoring && watches.length > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--accent-green)' }}>● {tk('process.port_watch.monitoring')}</span>
        )}
      </div>

      {watches.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0' }}>
          {tk('process.port_watch.description')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Watch list */}
          <div>
            <div style={sectionTitle}>{tk('process.port_watch.list')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {watches.map((watch) => {
                const status = statuses.get(watch.id)
                const isOpen = expandedWatch.has(watch.id)
                const connCount = status?.matches.length ?? 0
                const matches = status?.matches ?? []
                const listenC = matches.filter((m) => m.state === 'LISTEN').length
                const estC = matches.filter((m) => m.state === 'ESTABLISHED').length
                const otherC = matches.length - listenC - estC
                const activeFilter = watchFilters.get(watch.id) ?? 'all'

                const filtered = activeFilter === 'all' ? matches
                  : activeFilter === 'other' ? matches.filter((m) => m.state !== 'LISTEN' && m.state !== 'ESTABLISHED')
                  : matches.filter((m) => m.state === activeFilter)
                const display = filtered.slice(0, DISPLAY_LIMIT)
                const hidden = filtered.length - display.length

                return (
                  <div key={watch.id} style={{
                    borderRadius: '8px',
                    background: status?.matched ? 'var(--success-soft)' : 'var(--bg-primary)',
                    border: `1px solid ${status?.matched ? 'var(--accent-green)' : 'var(--border)'}`,
                    overflow: 'hidden'
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {status ? formatTime(status.lastChecked) : '--:--:--'}
                      </span>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        backgroundColor: status?.matched ? 'var(--accent-green)' : 'var(--text-muted)',
                        boxShadow: status?.matched ? '0 0 6px var(--accent-green)' : 'none'
                      }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        {watch.pattern}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-card-hover)' }}>
                        {watch.scope}:{watch.type}
                      </span>
                      <span style={{ flex: 1 }} />

                      {/* State counts */}
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                        <StateCount label="L" count={listenC} color="var(--accent-green)" active={activeFilter === 'LISTEN'} onClick={() => setWatchFilter(watch.id, 'LISTEN')} />
                        <StateCount label="E" count={estC} color="var(--accent-blue)" active={activeFilter === 'ESTABLISHED'} onClick={() => setWatchFilter(watch.id, 'ESTABLISHED')} />
                        {otherC > 0 && <StateCount label="O" count={otherC} color="var(--accent-yellow)" active={activeFilter === 'other'} onClick={() => setWatchFilter(watch.id, 'other')} />}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginLeft: '4px' }}>
                          {connCount}
                        </span>
                      </div>

                      {connCount > 0 && (
                        <button onClick={() => toggleExpanded(watch.id)}
                          style={{ ...detailsBtn, color: isOpen ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                          {isOpen ? `▼ ${tk('process.port_watch.hide')}` : `▶ ${tk('process.port_watch.details')}`}
                        </button>
                      )}
                      <button onClick={() => removeWatch(watch.id)} style={removeBtnStyle}>×</button>
                    </div>

                    {/* Detail table */}
                    {isOpen && connCount > 0 && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '6px 10px' }}>
                        {activeFilter !== 'all' && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            {activeFilter === 'LISTEN'
                              ? tk('process.port_watch.filtered_listening', { count: filtered.length })
                              : activeFilter === 'ESTABLISHED'
                                ? tk('process.port_watch.filtered_established', { count: filtered.length })
                                : tk('process.port_watch.filtered_other', { count: filtered.length })}
                          </div>
                        )}
                        <div style={{ maxHeight: '250px', overflow: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={thStyle}>{tk('process.port_watch.proto')}</th>
                                <th style={thStyle}>{tk('process.port_watch.local')}</th>
                                <th style={thStyle}>{tk('process.port_watch.remote')}</th>
                                <th style={thStyle}>{tk('process.port_watch.process')}</th>
                                <th style={thStyle}>{tk('process.port_watch.state')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {display.map((m, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{m.protocol}</td>
                                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{formatPortAddress(m.localAddress, m.localPort)}</td>
                                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{formatPortAddress(m.peerAddress, m.peerPort)}</td>
                                  <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-primary)' }}>{m.process}</td>
                                  <td style={tdStyle}><StateBadge state={m.state} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {hidden > 0 && (
                          <div style={{ padding: '6px 0', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            {tk('process.port_watch.more', { count: hidden.toLocaleString(), limit: DISPLAY_LIMIT })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between' }}>
                <span>{tk('process.port_watch.history')}</span>
                <button onClick={clearHistory} style={removeBtnStyle}>{tk('process.port_watch.clear')}</button>
              </div>
              <div style={{ maxHeight: '200px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {history.map((entry, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '8px', alignItems: 'center',
                    padding: '4px 8px', fontSize: '12px',
                    borderLeft: `3px solid ${entry.event === 'connected' ? 'var(--accent-green)' : 'var(--accent-red)'}`
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '11px', flexShrink: 0 }}>
                      {formatTime(entry.timestamp)}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-cyan)', flexShrink: 0 }}>
                      {entry.pattern}
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '3px',
                      background: entry.event === 'connected' ? 'var(--success-soft)' : 'var(--alert-red-soft)',
                      color: entry.event === 'connected' ? 'var(--accent-green)' : 'var(--accent-red)',
                      flexShrink: 0
                    }}>
                      {entry.event === 'connected' ? tk('process.port_watch.connected_label') : tk('process.port_watch.disconnected_label')}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.process}{entry.detail ? ` — ${entry.detail}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Sub-components ───

function StateCount({ label, count, color, active, onClick }: {
  label: string; count: number; color: string; active: boolean; onClick: () => void
}) {
  const { tk } = useI18n()
  if (count === 0) return null
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        padding: '1px 6px', fontSize: '10px', fontWeight: 600,
        border: active ? `1px solid ${color}` : '1px solid transparent',
        borderRadius: '4px', background: active ? `${color}20` : 'transparent',
        color, cursor: 'pointer'
      }}
      title={tk('process.port_watch.state_filter_title', {
        label: label === 'L'
          ? tk('process.port_watch.state.listening')
          : label === 'E'
            ? tk('process.port_watch.state.established')
            : tk('process.port_watch.state.other')
      })}
    >
      {label}:{count.toLocaleString()}
    </button>
  )
}

function StateBadge({ state }: { state: string }) {
  const s = getStateStyle(state)
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }} title={s.tip}>
      {state}
    </span>
  )
}

// ─── Styles ───

const inputStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: '13px', flex: 1, minWidth: '200px',
  border: '1px solid var(--border)', borderRadius: '6px',
  background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none',
  fontFamily: 'monospace'
}

const btnStyle: React.CSSProperties = {
  padding: '6px 16px', fontSize: '12px', fontWeight: 600,
  border: 'none', borderRadius: '6px',
  background: 'var(--accent-cyan)', color: 'var(--text-on-accent)', cursor: 'pointer'
}

const removeBtnStyle: React.CSSProperties = {
  padding: '2px 8px', fontSize: '14px', fontWeight: 600,
  border: 'none', borderRadius: '4px',
  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer'
}

const detailsBtn: React.CSSProperties = {
  padding: '2px 8px', fontSize: '11px', fontWeight: 500,
  border: 'none', borderRadius: '4px',
  background: 'transparent', cursor: 'pointer'
}

const sectionStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  padding: '16px'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '16px'
}

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minWidth: 0
}

const titleStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)'
}

const badgeStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '1px 8px',
  borderRadius: '4px',
  background: 'color-mix(in srgb, var(--accent-cyan) 16%, transparent)',
  color: 'var(--accent-cyan)',
  whiteSpace: 'nowrap'
}

const sectionTitle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px'
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 4px', color: 'var(--text-muted)',
  fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em'
}

const tdStyle: React.CSSProperties = { padding: '5px 4px', color: 'var(--text-secondary)', fontSize: '12px' }
