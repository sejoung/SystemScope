import { useEffect } from 'react'
import { useDiskStore } from '../../stores/useDiskStore'
import { formatBytes } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const DASHBOARD_STORAGE_LOAD_DELAY_MS = 1_500

const BAR_COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#06b6d4',
  '#ef4444', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6'
]

interface YourStorageProps {
  onFolderClick: (path: string) => void
}

export function YourStorage({ onFolderClick }: YourStorageProps) {
  const { tk } = useI18n()
  const info = useDiskStore((s) => s.userSpace)
  const loading = useDiskStore((s) => s.userSpaceLoading)
  const fetched = useDiskStore((s) => s.userSpaceFetched)
  const fetchUserSpace = useDiskStore((s) => s.fetchUserSpace)

  useEffect(() => {
    if (!info && !loading && !fetched) {
      const timer = window.setTimeout(() => {
        void fetchUserSpace()
      }, DASHBOARD_STORAGE_LOAD_DELAY_MS)

      return () => {
        window.clearTimeout(timer)
      }
    }
  }, [info, loading, fetched, fetchUserSpace])

  if (!info && !fetched) {
    return (
      <DashboardCard title={tk('disk.section.home_storage')}>
        <StoragePlaceholder message={tk('disk.home_storage.loading')} showSpinner={false} />
      </DashboardCard>
    )
  }

  if (!info && loading) {
    return (
      <DashboardCard title={tk('disk.section.home_storage')}>
        <StoragePlaceholder message={tk('disk.home_storage.loading')} showSpinner />
      </DashboardCard>
    )
  }

  if (!info) {
    return (
      <DashboardCard title={tk('disk.section.home_storage')}>
        <div
          style={{
            ...cardBodyStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
            textAlign: 'center'
          }}
        >
          {tk('disk.home_storage.load_failed')}
        </div>
      </DashboardCard>
    )
  }

  const usedBySystem = Math.max(info.diskTotal - info.diskAvailable - info.homeSize, 0)
  const diskUsedPercent = ((info.diskTotal - info.diskAvailable) / info.diskTotal) * 100

  return (
    <DashboardCard
      title={tk('disk.section.home_storage')}
      actions={
        <button
          onClick={() => fetchUserSpace()}
          disabled={loading}
          style={{
            ...subtleActionButtonStyle,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? tk('common.scanning') : tk('common.rescan')}
        </button>
      }
    >
      <div style={{ ...cardBodyStyle, minHeight: 'unset' }}>
        {/* Disk capacity summary */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {tk('disk.home_storage.disk_capacity')}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {tk('disk.home_storage.used_summary', {
                used: formatBytes(info.diskTotal - info.diskAvailable),
                total: formatBytes(info.diskTotal)
              })}
            </span>
          </div>

          {/* Stacked bar */}
          <div style={{
            width: '100%', height: '28px',
            backgroundColor: 'var(--disk-bar-available)', borderRadius: '8px',
            overflow: 'hidden', display: 'flex'
          }}>
            <div
              style={{
                width: `${(usedBySystem / info.diskTotal) * 100}%`,
                height: '100%',
                backgroundColor: 'var(--disk-bar-system)',
                transition: 'width 0.5s'
              }}
              title={tk('disk.home_storage.system') + `: ${formatBytes(usedBySystem)}`}
            />
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

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', fontSize: '11px', alignItems: 'center' }}>
            <LegendItem color="var(--disk-bar-system)" label={tk('disk.home_storage.system')} value={formatBytes(usedBySystem)} />
            <LegendItem color="#22c55e" label={tk('disk.home_storage.available')} value={formatBytes(info.diskAvailable)} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: 'auto' }}>
              {tk('disk.home_storage.used_percent', { percent: diskUsedPercent.toFixed(1) })}
            </span>
          </div>
        </div>

        {/* Home directory breakdown */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {tk('disk.home_storage.your_folders')}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {tk('disk.home_storage.total', { value: formatBytes(info.homeSize) })}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {info.entries.map((entry, i) => {
              const pct = info.homeSize > 0 ? (entry.size / info.homeSize) * 100 : 0
              return (
                <div
                  key={entry.name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    minWidth: 0
                  }}
                  onClick={() => onFolderClick(entry.path)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: BAR_COLORS[i % BAR_COLORS.length]
                  }} />

                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    width: '96px',
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {entry.name}
                  </span>

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

                  <span style={{
                    fontSize: '12px', fontWeight: 600, fontFamily: 'monospace',
                    color: 'var(--text-primary)', width: '76px', textAlign: 'right', flexShrink: 0
                  }}>
                    {formatBytes(entry.size)}
                  </span>

                  <button
                    onClick={(e) => { e.stopPropagation(); window.systemScope.showInFolder(entry.path) }}
                    style={{ ...subtleActionButtonStyle, flexShrink: 0 }}
                  >
                    {tk('common.open')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}

function DashboardCard({
  title,
  actions,
  children
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={dashboardCardStyle}>
      <div style={dashboardCardHeaderStyle}>
        <div style={dashboardCardTitleStyle}>{title}</div>
        {actions ? <div style={dashboardCardActionsStyle}>{actions}</div> : null}
      </div>
      <div style={dashboardCardContentStyle}>{children}</div>
    </div>
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

function StoragePlaceholder({ message, showSpinner }: { message: string; showSpinner: boolean }) {
  return (
    <div style={cardBodyStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'var(--text-muted)',
          fontSize: '13px',
          marginBottom: '18px'
        }}
      >
        {showSpinner ? <Spinner /> : <div style={spinnerSpacerStyle} />}
        {message}
      </div>
      <div style={{ ...placeholderBlockStyle, height: '28px', marginBottom: '10px' }} />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ ...placeholderBlockStyle, width: '120px', height: '12px' }} />
        <div style={{ ...placeholderBlockStyle, width: '110px', height: '12px' }} />
        <div style={{ ...placeholderBlockStyle, width: '84px', height: '12px', marginLeft: 'auto' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border)' }} />
            <div style={{ ...placeholderBlockStyle, width: '92px', height: '14px' }} />
            <div style={{ ...placeholderBlockStyle, flex: 1, height: '6px', borderRadius: '999px' }} />
            <div style={{ ...placeholderBlockStyle, width: '72px', height: '14px' }} />
            <div style={{ ...placeholderBlockStyle, width: '52px', height: '24px', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

const subtleActionButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: '11px',
  fontWeight: 600,
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)'
}

const cardBodyStyle: React.CSSProperties = {
  minHeight: '360px'
}

const placeholderBlockStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  borderRadius: '8px'
}

const spinnerSpacerStyle: React.CSSProperties = {
  width: '14px',
  height: '14px',
  flexShrink: 0
}

const dashboardCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column'
}

const dashboardCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  flexWrap: 'wrap'
}

const dashboardCardTitleStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)'
}

const dashboardCardActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap'
}

const dashboardCardContentStyle: React.CSSProperties = {
  padding: '16px'
}
