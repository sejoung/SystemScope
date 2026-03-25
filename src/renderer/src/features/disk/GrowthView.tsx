import { useEffect } from 'react'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'
import { useDiskStore } from '../../stores/useDiskStore'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import type { GrowthFolder } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'

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
      fetchGrowthView()
    }
  }, [result, loading, fetchGrowthView])

  const handlePeriodChange = (p: string) => {
    setPeriod(p)
    if (result) fetchGrowthView(p)
  }

  const top5 = result ? result.folders.slice(0, 5) : []
  const hasData = result && result.totalAdded > 0

  return (
    <Accordion
      title={tk('disk.section.storage_growth')}
      badge={loading ? tk('common.analyzing') : hasData ? tk('disk.storage_growth.badge', { size: formatBytes(result!.totalAdded), period: PERIOD_LABELS[result!.period] }) : undefined}
      badgeColor={loading ? 'var(--text-muted)' : 'var(--accent-yellow)'}
      defaultOpen
      forceOpen={!!hasData || loading}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0' }}>
          {loading && (
            <div style={{
              width: '14px', height: '14px',
              border: '2px solid var(--accent-yellow)',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          )}
          {loading ? tk('disk.storage_growth.loading') : tk('disk.storage_growth.description')}
          {loading && <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>}
        </div>
      ) : result.totalAdded === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 0' }}>
          {tk('disk.storage_growth.no_changes', { period: PERIOD_LABELS[result.period] })}
          <br />
          <span style={{ fontSize: '11px' }}>
            {tk('disk.storage_growth.snapshots_hint')}
          </span>
        </div>
      ) : (
        <div>
          {/* Summary */}
          <div style={{
            display: 'flex', gap: '12px', marginBottom: '16px', padding: '10px 14px',
            background: 'var(--bg-primary)', borderRadius: 'var(--radius)', fontSize: '13px',
            flexWrap: 'wrap'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {tk('disk.storage_growth.added')}: <strong style={{ color: 'var(--accent-yellow)' }}>+{formatBytes(result.totalAdded)}</strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              {tk('disk.storage_growth.files')}: <strong style={{ color: 'var(--text-primary)' }}>{result.totalAddedFiles.toLocaleString()}</strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              {tk('disk.storage_growth.period')}: <strong style={{ color: 'var(--text-primary)' }}>{PERIOD_LABELS[result.period]}</strong>
            </span>
          </div>

          {/* Top 5 Chart + List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Bar Chart */}
            <div ref={chartRef}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
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
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {tk('disk.storage_growth.all_folders')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflow: 'auto' }}>
                {result.folders.map((folder, i) => (
                  <FolderRow key={folder.path} folder={folder} index={i} maxAdded={result.folders[0]?.addedSize ?? 1} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Accordion>
  )
}

function FolderRow({ folder, index, maxAdded }: { folder: GrowthFolder; index: number; maxAdded: number }) {
  const pct = (folder.addedSize / maxAdded) * 100
  const growthPct = (folder.growthRate * 100).toFixed(1)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 8px', borderRadius: '6px',
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
  padding: '5px 14px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--accent-yellow)',
  color: 'var(--text-on-accent-strong)',
  cursor: 'pointer'
}
