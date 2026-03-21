import { useEffect } from 'react'
import { useDiskStore } from '../../stores/useDiskStore'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'

const BAR_COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#06b6d4',
  '#ef4444', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6'
]

interface YourStorageProps {
  onFolderClick: (path: string) => void
}

export function YourStorage({ onFolderClick }: YourStorageProps) {
  const info = useDiskStore((s) => s.userSpace)
  const loading = useDiskStore((s) => s.userSpaceLoading)
  const fetchUserSpace = useDiskStore((s) => s.fetchUserSpace)

  useEffect(() => {
    if (!info && !loading) {
      fetchUserSpace()
    }
  }, [info, loading, fetchUserSpace])

  if (!info && loading) {
    return (
      <Accordion title="Your Storage" defaultOpen>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', justifyContent: 'center'
        }}>
          <Spinner />
          폴더 크기 분석 중... (첫 실행 시 수 초 소요)
        </div>
      </Accordion>
    )
  }

  if (!info) return null

  const usedBySystem = Math.max(info.diskTotal - info.diskAvailable - info.homeSize, 0)
  const diskUsedPercent = ((info.diskTotal - info.diskAvailable) / info.diskTotal) * 100

  return (
    <Accordion title="Your Storage" defaultOpen>
      {/* Disk capacity summary */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '13px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Disk Capacity
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {formatBytes(info.diskTotal - info.diskAvailable)} used / {formatBytes(info.diskTotal)}
            </span>
            <button
              onClick={() => fetchUserSpace()}
              disabled={loading}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '5px',
                background: 'var(--bg-card-hover)',
                color: 'var(--text-primary)',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? 'Scanning...' : 'Rescan'}
            </button>
          </div>
        </div>

        {/* Stacked bar */}
        <div style={{
          width: '100%', height: '28px',
          backgroundColor: '#1a3a2a', borderRadius: '8px',
          overflow: 'hidden', display: 'flex'
        }}>
          {/* System */}
          <div
            style={{
              width: `${(usedBySystem / info.diskTotal) * 100}%`,
              height: '100%',
              backgroundColor: '#94a3b8',
              transition: 'width 0.5s'
            }}
            title={`System: ${formatBytes(usedBySystem)}`}
          />
          {/* Home folders */}
          {info.entries.map((entry, i) => {
            const pct = (entry.size / info.diskTotal) * 100
            if (pct < 0.3) return null
            return (
              <div
                key={entry.name}
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                  transition: 'width 0.5s',
                  minWidth: '2px'
                }}
                title={`${entry.name}: ${formatBytes(entry.size)}`}
              />
            )
          })}
          {/* Available — 밝은 녹색 배경으로 "여유 공간" 시각화 */}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap', fontSize: '11px', alignItems: 'center' }}>
          <LegendItem color="#94a3b8" label="System" value={formatBytes(usedBySystem)} />
          <LegendItem color="#22c55e" label="Available" value={formatBytes(info.diskAvailable)} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: 'auto' }}>
            {diskUsedPercent.toFixed(1)}% used
          </span>
        </div>
      </div>

      {/* Home directory breakdown */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Folders
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Total: <strong style={{ color: 'var(--text-primary)' }}>{formatBytes(info.homeSize)}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {info.entries.map((entry, i) => {
            const pct = info.homeSize > 0 ? (entry.size / info.homeSize) * 100 : 0
            return (
              <div
                key={entry.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onClick={() => onFolderClick(entry.path)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                {/* Color dot */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length]
                }} />

                {/* Name */}
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', width: '120px', flexShrink: 0 }}>
                  {entry.name}
                </span>

                {/* Bar */}
                <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                    borderRadius: '3px',
                    minWidth: entry.size > 0 ? '2px' : '0',
                    transition: 'width 0.5s'
                  }} />
                </div>

                {/* Size */}
                <span style={{
                  fontSize: '12px', fontWeight: 600, fontFamily: 'monospace',
                  color: 'var(--text-primary)', width: '70px', textAlign: 'right', flexShrink: 0
                }}>
                  {formatBytes(entry.size)}
                </span>

                {/* Open button */}
                <button
                  onClick={(e) => { e.stopPropagation(); window.systemScope.showInFolder(entry.path) }}
                  style={{
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '5px',
                    background: 'var(--bg-card-hover)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  Open
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </Accordion>
  )
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{
        width: '10px', height: '10px', borderRadius: '3px',
        backgroundColor: color, display: 'inline-block'
      }} />
      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </span>
  )
}

function Spinner() {
  return (
    <>
      <div style={{
        width: '14px', height: '14px',
        border: '2px solid var(--accent-blue)',
        borderTop: '2px solid transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
