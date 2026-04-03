import { useEffect, useState } from 'react'
import { formatBytes } from '@shared/utils/formatBytes'
import { useProjectMonitorStore } from '../../stores/useProjectMonitorStore'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'

interface ProjectMonitorCardProps {
  compact?: boolean
}

export function ProjectMonitorCard({ compact = false }: ProjectMonitorCardProps) {
  const summary = useProjectMonitorStore((s) => s.summary)
  const loading = useProjectMonitorStore((s) => s.loading)
  const fetchSummary = useProjectMonitorStore((s) => s.fetchSummary)
  const showToast = useToast((s) => s.show)
  const { tk } = useI18n()
  const [expandedPath, setExpandedPath] = useState<string | null>(null)

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  if (!loading && (!summary || summary.workspaces.length === 0)) {
    return null
  }

  return (
    <div style={compact ? compactCardStyle : cardStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>{tk('Project Monitor')}</div>
          <div style={subtitleStyle}>
            {summary
              ? tk('{count} workspaces tracked', { count: summary.workspaces.length })
              : tk('Loading...')}
          </div>
        </div>
        {summary && (
          <div style={{ textAlign: 'right' }}>
            <div style={metricLabelStyle}>{tk('Recent Growth')}</div>
            <div style={metricValueStyle}>{formatBytes(summary.totalRecentGrowthBytes)}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {summary?.workspaces.slice(0, compact ? 3 : undefined).map((workspace) => (
          <div key={workspace.path} style={workspaceCardStyle}>
            <div style={workspaceRowStyle}>
              <button
                type="button"
                onClick={() =>
                  compact
                    ? undefined
                    : setExpandedPath((prev) => prev === workspace.path ? null : workspace.path)
                }
                style={workspaceToggleStyle}
              >
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <div style={workspaceNameStyle}>{workspace.name}</div>
                  <div style={workspacePathStyle}>{workspace.path}</div>
                </div>
              </button>
              <div style={{ textAlign: 'right' }}>
                <div style={workspaceSizeStyle}>{formatBytes(workspace.currentSize)}</div>
                <div style={{
                  ...workspaceGrowthStyle,
                  color: workspace.recentGrowthBytes > 0 ? 'var(--accent-orange)' : 'var(--text-muted)'
                }}>
                  +{formatBytes(workspace.recentGrowthBytes)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void window.systemScope.showInFolder(workspace.path).then((res) => {
                    if (!res.ok) {
                      showToast(res.error?.message ?? tk('Unable to open folder.'))
                    }
                  })
                }}
                style={openButtonStyle}
              >
                {tk('Open')}
              </button>
            </div>
            {!compact && expandedPath === workspace.path && (
              <div style={detailSectionStyle}>
                <div style={detailLabelStyle}>{tk('Category Breakdown')}</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {workspace.topCategories.map((category) => (
                    <div key={category.category} style={detailRowStyle}>
                      <span>{category.label}</span>
                      <span>{formatBytes(category.size)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={detailLabelStyle}>{tk('Recent Trend')}</div>
                  <div style={historyRowStyle}>
                    {workspace.history.map((point) => (
                      <div key={point.scannedAt} style={historyPillStyle}>
                        {formatBytes(point.size)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {compact && summary && summary.workspaces.length > 3 ? (
        <div style={compactHintStyle}>
          {tk('{count} more workspaces are available in DevTools > Workspaces.', {
            count: summary.workspaces.length - 3,
          })}
        </div>
      ) : null}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 16,
  marginBottom: 16
}

const compactCardStyle: React.CSSProperties = {
  ...cardStyle,
  marginBottom: 12
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  marginBottom: 12
}

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-primary)'
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)'
}

const metricLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase'
}

const metricValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--text-primary)'
}

const workspaceRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  gap: 10,
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--bg-secondary)'
}

const workspaceCardStyle: React.CSSProperties = {
  borderRadius: 10,
  background: 'var(--bg-secondary)',
  overflow: 'hidden'
}

const workspaceToggleStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer'
}

const workspaceNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)'
}

const workspacePathStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
}

const workspaceSizeStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-primary)'
}

const workspaceGrowthStyle: React.CSSProperties = {
  fontSize: 11
}

const openButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: 12
}

const detailSectionStyle: React.CSSProperties = {
  padding: '0 12px 12px',
  display: 'grid',
  gap: 6
}

const detailLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  color: 'var(--text-muted)'
}

const detailRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 12,
  color: 'var(--text-secondary)'
}

const historyRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap'
}

const historyPillStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 999,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  fontSize: 11,
  color: 'var(--text-secondary)'
}

const compactHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)'
}
