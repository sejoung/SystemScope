import { useEffect } from 'react'
import { useDiskStore } from '../../stores/useDiskStore'
import { Card } from '../../components/Card'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

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

  // 캐시가 없을 때만 fetch (페이지 이동 시 재호출 안 함)
  useEffect(() => {
    if (!info && !loading) {
      fetchUserSpace()
    }
  }, [info, loading, fetchUserSpace])

  if (!info && loading) {
    return (
      <Card>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', justifyContent: 'center'
        }}>
          <Spinner />
          폴더 크기 분석 중... (첫 실행 시 수 초 소요)
        </div>
      </Card>
    )
  }

  if (!info) return null

  const usedBySystem = info.diskTotal - info.diskAvailable - info.homeSize
  const diskUsedPercent = ((info.diskTotal - info.diskAvailable) / info.diskTotal) * 100

  return (
    <Card>
      {/* Disk capacity summary */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px' }}>
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
                padding: '3px 10px', fontSize: '11px', fontWeight: 500,
                border: '1px solid var(--border)', borderRadius: '5px',
                background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer'
              }}
            >
              {loading ? '...' : 'Rescan'}
            </button>
          </div>
        </div>

        {/* Stacked bar: system + home folders + available */}
        <div style={{
          width: '100%', height: '24px',
          backgroundColor: 'var(--border)', borderRadius: '6px',
          overflow: 'hidden', display: 'flex', position: 'relative'
        }}>
          {/* System (grey) */}
          <div
            style={{
              width: `${(usedBySystem / info.diskTotal) * 100}%`,
              height: '100%',
              backgroundColor: '#64748b',
              transition: 'width 0.5s'
            }}
            title={`System: ${formatBytes(usedBySystem > 0 ? usedBySystem : 0)}`}
          />
          {/* Home folders (colored segments) */}
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
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
          <LegendItem color="#64748b" label="System" value={formatBytes(usedBySystem > 0 ? usedBySystem : 0)} />
          <LegendItem color="var(--text-muted)" label="Available" value={formatBytes(info.diskAvailable)} />
          <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
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
          <span style={{ color: 'var(--text-muted)' }}>
            Total: {formatBytes(info.homeSize)}
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
                  color: 'var(--text-secondary)', width: '70px', textAlign: 'right', flexShrink: 0
                }}>
                  {formatBytes(entry.size)}
                </span>

                {/* Open button */}
                <button
                  onClick={(e) => { e.stopPropagation(); window.systemScope.showInFolder(entry.path) }}
                  style={{
                    padding: '2px 8px', fontSize: '11px', fontWeight: 500,
                    border: '1px solid var(--border)', borderRadius: '5px',
                    background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
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
    </Card>
  )
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: color, display: 'inline-block' }} />
      {label}: {value}
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
