import { useI18n } from '../../i18n/useI18n'
import type { AlertIntelligence, AlertHistoryEntry, AlertPattern } from '@shared/types'

function formatDuration(
  ms: number,
  t: (text: string, params?: Record<string, string | number>) => string,
): string {
  const totalSeconds = Math.floor(ms / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (totalMinutes < 1) return t('< 1m')
  if (hours === 0) return t('{count}m', { count: totalMinutes })
  return t('{hours}h {minutes}m', { hours, minutes })
}

function getSeverityDotColor(severity: 'warning' | 'critical'): string {
  return severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-yellow)'
}

function formatAlertType(
  type: AlertPattern['type'] | AlertHistoryEntry['type'],
  t: (text: string, params?: Record<string, string | number>) => string,
): string {
  switch (type) {
    case 'cpu':
      return t('CPU')
    case 'disk':
      return t('Disk')
    case 'memory':
      return t('Memory')
    case 'gpu':
      return t('GPU')
    default:
      return type
  }
}

interface AlertIntelligencePanelProps {
  intelligence: AlertIntelligence | null
  loading: boolean
}

export function AlertIntelligencePanel({ intelligence, loading }: AlertIntelligencePanelProps) {
  const { tk, t } = useI18n()

  const sustainedAlerts = intelligence?.sustainedAlerts ?? []
  const patterns = intelligence?.patterns ?? []

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <h3
        style={{
          fontSize: '14px',
          fontWeight: 700,
          margin: '0 0 12px 0',
          color: 'var(--text-primary)',
        }}
      >
        {tk('alert.intelligence.title')}
      </h3>

      {loading ? (
        <div style={emptyBoxStyle}>{tk('timeline.loading')}</div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Sustained Alerts */}
          <div>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {tk('alert.intelligence.sustained')}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                {tk('alert.intelligence.sustained_desc')}
              </span>
            </div>
            {sustainedAlerts.length === 0 ? (
              <div style={emptyItemStyle}>{t('No sustained alerts')}</div>
            ) : (
              <div style={{ display: 'grid', gap: '6px' }}>
                {sustainedAlerts.map((alert: AlertHistoryEntry) => (
                  <div key={alert.id} style={itemStyle}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getSeverityDotColor(alert.severity),
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                      {alert.message || formatAlertType(alert.type, t)}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {alert.durationMs !== null && alert.durationMs !== undefined ? formatDuration(alert.durationMs, t) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert Patterns */}
          <div>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {tk('alert.intelligence.patterns')}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                {tk('alert.intelligence.patterns_desc')}
              </span>
            </div>
            {patterns.length === 0 ? (
              <div style={emptyItemStyle}>{t('No recurring patterns')}</div>
            ) : (
              <div style={{ display: 'grid', gap: '6px' }}>
                {patterns.map((pattern: AlertPattern) => (
                  <div key={pattern.type} style={itemStyle}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                      {formatAlertType(pattern.type, t)}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {pattern.count} {tk('alert.intelligence.occurrences')} {pattern.period}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const emptyBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '80px',
  color: 'var(--text-muted)',
  fontSize: '13px',
}

const emptyItemStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: 'var(--bg-secondary)',
  borderRadius: 'var(--radius)',
  fontSize: '13px',
  color: 'var(--text-muted)',
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  background: 'var(--bg-secondary)',
  borderRadius: 'var(--radius)',
}
