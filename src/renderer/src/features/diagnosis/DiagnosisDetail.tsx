import { useSettingsStore, type AppPage } from '../../stores/useSettingsStore'
import { useI18n } from '../../i18n/useI18n'
import type { DiagnosisResult, DiagnosisSeverity } from '@shared/types'

const severityColors: Record<DiagnosisSeverity, string> = {
  critical: 'var(--accent-red)',
  warning: 'var(--accent-orange)',
  info: 'var(--accent-blue)'
}

const severityBgColors: Record<DiagnosisSeverity, string> = {
  critical: 'color-mix(in srgb, var(--accent-red) 14%, transparent)',
  warning: 'color-mix(in srgb, var(--accent-orange) 14%, transparent)',
  info: 'color-mix(in srgb, var(--accent-blue) 14%, transparent)'
}

interface DiagnosisDetailProps {
  result: DiagnosisResult
}

export function DiagnosisDetail({ result }: DiagnosisDetailProps) {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const { t } = useI18n()

  const detectedDate = new Date(result.detectedAt)

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 'var(--radius)',
            background: severityBgColors[result.severity],
            color: severityColors[result.severity],
            textTransform: 'uppercase'
          }}
        >
          {result.severity}
        </span>
        <span style={categoryLabelStyle}>
          {formatCategory(result.category)}
        </span>
      </div>

      {/* Title */}
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        {result.title}
      </h3>

      {/* Description */}
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
        {result.description}
      </p>

      {/* Evidence table */}
      {result.evidence.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={sectionLabelStyle}>{t('Evidence')}</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t('Metric')}</th>
                <th style={thStyle}>{t('Value')}</th>
                <th style={thStyle}>{t('Threshold')}</th>
              </tr>
            </thead>
            <tbody>
              {result.evidence.map((ev, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{ev.label}</td>
                  <td style={tdStyle}>{ev.value}</td>
                  <td style={tdStyle}>{ev.threshold ?? '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      {result.actions.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={sectionLabelStyle}>{t('Recommended Actions')}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {result.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  if (action.targetPage) setCurrentPage(action.targetPage as AppPage)
                }}
                style={actionButtonStyle}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        {t('Detected at')} {detectedDate.toLocaleString()}
      </div>
    </div>
  )
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px'
}

const categoryLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)'
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px'
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px 6px 0',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border)'
}

const tdStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px 6px 0',
  color: 'var(--text-primary)',
  borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)'
}

const actionButtonStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: 600,
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--accent-blue)',
  cursor: 'pointer'
}
