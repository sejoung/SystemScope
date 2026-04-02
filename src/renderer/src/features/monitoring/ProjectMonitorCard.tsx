import { useEffect } from 'react'
import { formatBytes } from '@shared/utils/formatBytes'
import { useProjectMonitorStore } from '../../stores/useProjectMonitorStore'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'

export function ProjectMonitorCard() {
  const summary = useProjectMonitorStore((s) => s.summary)
  const loading = useProjectMonitorStore((s) => s.loading)
  const fetchSummary = useProjectMonitorStore((s) => s.fetchSummary)
  const showToast = useToast((s) => s.show)
  const { t } = useI18n()

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  if (!loading && (!summary || summary.workspaces.length === 0)) {
    return null
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>{t('Project Monitor')}</div>
          <div style={subtitleStyle}>
            {summary
              ? t('{count} workspaces tracked', { count: summary.workspaces.length })
              : t('Loading...')}
          </div>
        </div>
        {summary && (
          <div style={{ textAlign: 'right' }}>
            <div style={metricLabelStyle}>{t('Recent Growth')}</div>
            <div style={metricValueStyle}>{formatBytes(summary.totalRecentGrowthBytes)}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {summary?.workspaces.map((workspace) => (
          <div key={workspace.path} style={workspaceRowStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={workspaceNameStyle}>{workspace.name}</div>
              <div style={workspacePathStyle}>{workspace.path}</div>
            </div>
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
                    showToast(res.error?.message ?? t('Unable to open folder.'))
                  }
                })
              }}
              style={openButtonStyle}
            >
              {t('Open')}
            </button>
          </div>
        ))}
      </div>
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
