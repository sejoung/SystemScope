import { useEffect } from 'react'
import { formatBytes } from '../../utils/format'
import { useDiskStore } from '../../stores/useDiskStore'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import type { GrowthFolder } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'

const DASHBOARD_GROWTH_LOAD_DELAY_MS = 2_500

const PERIOD_LABELS: Record<string, string> = {
  '1h': '1 Hour',
  '24h': '24 Hours',
  '7d': '7 Days'
}

const BAR_COLORS = ['#eab308', '#f97316', '#ef4444', '#a855f7', '#3b82f6', '#22c55e', '#06b6d4', '#ec4899']

export function GrowthView() {
  const { tk } = useI18n()
  const result = useDiskStore((s) => s.growthView)
  const loading = useDiskStore((s) => s.growthViewLoading)
  const period = useDiskStore((s) => s.growthViewPeriod)
  const setPeriod = useDiskStore((s) => s.setGrowthViewPeriod)
  const fetchGrowthView = useDiskStore((s) => s.fetchGrowthView)
  const [chartRef, chartWidth] = useContainerWidth(400)

  // 캐시 없으면 자동 fetch (YourStorage와 동일 패턴)
  useEffect(() => {
    if (!result && !loading) {
      const timer = window.setTimeout(() => {
        void fetchGrowthView()
      }, DASHBOARD_GROWTH_LOAD_DELAY_MS)

      return () => {
        window.clearTimeout(timer)
      }
    }
  }, [result, loading, fetchGrowthView])

  const handlePeriodChange = (p: string) => {
    setPeriod(p)
    if (result) fetchGrowthView(p)
  }

  const top5 = result ? result.folders.slice(0, 5) : []
  const hasData = result && result.totalAdded > 0

  return (
    <DashboardCard
      title={tk('disk.section.storage_growth')}
      badge={loading ? tk('common.analyzing') : hasData ? tk('disk.storage_growth.badge', { size: formatBytes(result!.totalAdded), period: PERIOD_LABELS[result!.period] }) : undefined}
      badgeColor={loading ? 'var(--text-muted)' : 'var(--accent-yellow)'}
      actions={
        <>
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-primary)', borderRadius: '6px', padding: '2px' }}>
            {['1h', '24h', '7d'].map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '5px',
                  background: period === p ? 'var(--accent-yellow)' : 'transparent',
                  color: period === p ? 'var(--text-on-accent-strong)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <button onClick={() => fetchGrowthView()} disabled={loading} style={btnStyle}>
            {loading ? tk('common.analyzing') : result ? tk('apps.action.refresh') : tk('common.analyze')}
          </button>
        </>
      }
    >
      {!result ? (
        <GrowthPlaceholder message={loading ? tk('disk.storage_growth.loading') : tk('disk.storage_growth.description')} showSpinner={loading} />
      ) : result.totalAdded === 0 ? (
        <div style={{ ...cardBodyStyle, fontSize: '13px', color: 'var(--text-muted)', padding: '8px 0' }}>
          {tk('disk.storage_growth.no_changes', { period: PERIOD_LABELS[result.period] })}
          <br />
          <span style={{ fontSize: '11px' }}>
            {tk('disk.storage_growth.snapshots_hint')}
          </span>
        </div>
      ) : (
        <div style={{ ...cardBodyStyle, minHeight: 'unset' }}>
          {/* Summary */}
          <div style={{
            display: 'flex', gap: '10px', marginBottom: '14px', padding: '9px 12px',
            background: 'var(--bg-primary)', borderRadius: 'var(--radius)', fontSize: '13px',
            flexWrap: 'wrap'
          }}>
            <span style={summaryPillStyle}>
              <span style={{ color: 'var(--text-muted)' }}>{tk('disk.storage_growth.added')}:</span>
              <strong style={{ color: 'var(--accent-yellow)' }}>+{formatBytes(result.totalAdded)}</strong>
            </span>
            <span style={summaryPillStyle}>
              <span style={{ color: 'var(--text-muted)' }}>{tk('disk.storage_growth.files')}:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{result.totalAddedFiles.toLocaleString()}</strong>
            </span>
            <span style={summaryPillStyle}>
              <span style={{ color: 'var(--text-muted)' }}>{tk('disk.storage_growth.period')}:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{PERIOD_LABELS[result.period]}</strong>
            </span>
          </div>

          {/* Top 5 Chart + List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Bar Chart */}
            <div ref={chartRef}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                {tk('disk.storage_growth.top', { count: Math.min(top5.length, 5) })}
              </div>
              {chartWidth > 0 && (
                <BarChart data={top5} layout="vertical" width={chartWidth} height={160} margin={{ left: 60, right: 10 }}>
                  <XAxis
                    type="number"
                    axisLine={{ stroke: 'var(--chart-grid)' }}
                    tickLine={{ stroke: 'var(--chart-grid)' }}
                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    tickFormatter={(v) => formatBytes(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    width={65}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--chart-tooltip-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: 'var(--chart-tooltip-shadow)',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                    formatter={(value) => {
                      const numericValue = typeof value === 'number' ? value : 0
                      return [`+${formatBytes(numericValue)}`, tk('disk.storage_growth.added')]
                    }}
                  />
                  <Bar dataKey="addedSize" radius={[0, 4, 4, 0]}>
                    {top5.map((folder, i) => (
                      <Cell key={folder.path} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </div>

            {/* Detail List */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                {tk('disk.storage_growth.all_folders')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '180px', overflow: 'auto' }}>
                {result.folders.map((folder, i) => (
                  <FolderRow key={folder.path} folder={folder} index={i} maxAdded={result.folders[0]?.addedSize ?? 1} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}

function DashboardCard({
  title,
  badge,
  badgeColor,
  actions,
  children
}: {
  title: string
  badge?: string
  badgeColor?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={dashboardCardStyle}>
      <div style={dashboardCardHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
          <div style={dashboardCardTitleStyle}>{title}</div>
          {badge ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '1px 8px',
                borderRadius: '4px',
                background: badgeColor ? `${badgeColor}20` : 'var(--bg-card-hover)',
                color: badgeColor ?? 'var(--text-secondary)',
                whiteSpace: 'nowrap'
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        {actions ? <div style={dashboardCardActionsStyle}>{actions}</div> : null}
      </div>
      <div style={dashboardCardContentStyle}>{children}</div>
    </div>
  )
}

function GrowthPlaceholder({ message, showSpinner }: { message: string; showSpinner: boolean }) {
  return (
    <div style={cardBodyStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
        {showSpinner ? (
          <div style={spinnerStyle} />
        ) : (
          <div style={spinnerSpacerStyle} />
        )}
        {message}
        {showSpinner && <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ ...placeholderBlockStyle, width: '120px', height: '28px', borderRadius: '999px' }} />
        <div style={{ ...placeholderBlockStyle, width: '104px', height: '28px', borderRadius: '999px' }} />
        <div style={{ ...placeholderBlockStyle, width: '126px', height: '28px', borderRadius: '999px' }} />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ ...placeholderBlockStyle, width: '108px', height: '12px', marginBottom: '8px' }} />
        <div style={{ ...placeholderBlockStyle, width: '100%', height: '160px' }} />
      </div>
      <div>
        <div style={{ ...placeholderBlockStyle, width: '92px', height: '12px', marginBottom: '8px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border)' }} />
              <div style={{ ...placeholderBlockStyle, width: '78px', height: '14px' }} />
              <div style={{ ...placeholderBlockStyle, flex: 1, height: '4px', borderRadius: '999px' }} />
              <div style={{ ...placeholderBlockStyle, width: '65px', height: '14px' }} />
              <div style={{ ...placeholderBlockStyle, width: '45px', height: '12px' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FolderRow({ folder, index, maxAdded }: { folder: GrowthFolder; index: number; maxAdded: number }) {
  const pct = (folder.addedSize / maxAdded) * 100
  const growthPct = (folder.growthRate * 100).toFixed(1)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 8px', borderRadius: '7px',
        cursor: 'pointer', transition: 'background 0.15s'
      }}
      onClick={() => window.systemScope.showInFolder(folder.path)}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
        backgroundColor: BAR_COLORS[index % BAR_COLORS.length]
      }} />

      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', minWidth: '60px', maxWidth: '100px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {folder.name}
      </span>

      <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
          borderRadius: '2px', minWidth: '2px'
        }} />
      </div>

      <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--accent-yellow)', width: '65px', textAlign: 'right', flexShrink: 0 }}>
        +{formatBytes(folder.addedSize)}
      </span>

      <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '45px', textAlign: 'right', flexShrink: 0 }}>
        {growthPct}%
      </span>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: '11px',
  fontWeight: 600,
  border: '1px solid color-mix(in srgb, var(--accent-yellow) 35%, var(--border))',
  borderRadius: '6px',
  background: 'color-mix(in srgb, var(--accent-yellow) 18%, var(--bg-card))',
  color: 'var(--text-on-accent-strong)',
  cursor: 'pointer'
}

const summaryPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 8px',
  borderRadius: '999px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)'
}

const cardBodyStyle: React.CSSProperties = {
  minHeight: '360px'
}

const placeholderBlockStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  borderRadius: '8px'
}

const spinnerStyle: React.CSSProperties = {
  width: '14px',
  height: '14px',
  border: '2px solid var(--accent-yellow)',
  borderTop: '2px solid transparent',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite'
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
