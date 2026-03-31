import { useEffect, useState } from 'react'
import { useDiagnosisStore } from '../../stores/useDiagnosisStore'
import { useSettingsStore, type AppPage } from '../../stores/useSettingsStore'
import { useI18n } from '../../i18n/useI18n'
import type { DiagnosisResult, DiagnosisSeverity } from '@shared/types'

const MAX_VISIBLE = 4

const severityColors: Record<DiagnosisSeverity, string> = {
  critical: 'var(--accent-red)',
  warning: 'var(--accent-orange)',
  info: 'var(--accent-blue)'
}

const severityOrder: Record<DiagnosisSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2
}

export function DiagnosisCard() {
  const summary = useDiagnosisStore((s) => s.summary)
  const loading = useDiagnosisStore((s) => s.loading)
  const error = useDiagnosisStore((s) => s.error)
  const fetchDiagnosis = useDiagnosisStore((s) => s.fetchDiagnosis)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const { t } = useI18n()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    void fetchDiagnosis()
  }, [fetchDiagnosis])

  if (loading && !summary) return null
  if (error) return null

  const results = summary?.results ?? []
  const sorted = [...results].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  )

  const criticalCount = results.filter((r) => r.severity === 'critical').length
  const warningCount = results.filter((r) => r.severity === 'warning').length
  const infoCount = results.filter((r) => r.severity === 'info').length

  const visible = showAll ? sorted : sorted.slice(0, MAX_VISIBLE)
  const hasMore = sorted.length > MAX_VISIBLE

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('System Diagnosis')}
          </span>
          {results.length === 0 && (
            <span style={{ ...badgeStyle, background: 'color-mix(in srgb, var(--accent-green) 18%, transparent)', color: 'var(--accent-green)' }}>
              {t('Healthy')}
            </span>
          )}
        </div>
        {results.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
            {criticalCount > 0 && (
              <span style={{ color: severityColors.critical }}>
                {criticalCount} {t('critical')}
              </span>
            )}
            {warningCount > 0 && (
              <span style={{ color: severityColors.warning }}>
                {warningCount} {t('warning')}
              </span>
            )}
            {infoCount > 0 && (
              <span style={{ color: severityColors.info }}>
                {infoCount} {t('info')}
              </span>
            )}
          </div>
        )}
      </div>

      {results.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '4px 0' }}>
          {t('No issues detected. Your system is running smoothly.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {visible.map((result) => (
            <DiagnosisItem
              key={result.id}
              result={result}
              expanded={expandedId === result.id}
              onToggle={() => setExpandedId(expandedId === result.id ? null : result.id)}
              onNavigate={(page) => setCurrentPage(page as AppPage)}
              t={t}
            />
          ))}
          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              style={showAllButtonStyle}
            >
              {t('Show all ({count})', { count: sorted.length })}
            </button>
          )}
          {showAll && hasMore && (
            <button
              onClick={() => setShowAll(false)}
              style={showAllButtonStyle}
            >
              {t('Show less')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DiagnosisItem({
  result,
  expanded,
  onToggle,
  onNavigate,
  t
}: {
  result: DiagnosisResult
  expanded: boolean
  onToggle: () => void
  onNavigate: (page: string) => void
  t: (text: string, params?: Record<string, string | number>) => string
}) {
  return (
    <div style={itemContainerStyle}>
      <button
        type="button"
        onClick={onToggle}
        style={itemHeaderStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: severityColors[result.severity],
              flexShrink: 0
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.title}
          </span>
          <span style={{ ...categoryBadgeStyle }}>
            {formatCategory(result.category)}
          </span>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {expanded && (
        <div style={expandedContentStyle}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {result.description}
          </div>

          {result.evidence.length > 0 && (
            <table style={evidenceTableStyle}>
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
          )}

          {result.actions.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
              {result.actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (action.targetPage) onNavigate(action.targetPage)
                  }}
                  style={actionButtonStyle}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '16px',
  marginBottom: '16px'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px'
}

const badgeStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 'var(--radius)'
}

const itemContainerStyle: React.CSSProperties = {
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  overflow: 'hidden'
}

const itemHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '8px 12px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  textAlign: 'left',
  font: 'inherit'
}

const categoryBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 'var(--radius)',
  background: 'color-mix(in srgb, var(--text-muted) 12%, transparent)',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  flexShrink: 0
}

const expandedContentStyle: React.CSSProperties = {
  padding: '8px 12px 12px',
  borderTop: '1px solid var(--border)'
}

const evidenceTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px'
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px 4px 0',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border)'
}

const tdStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px 4px 0',
  color: 'var(--text-primary)'
}

const actionButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: 600,
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--accent-blue)',
  cursor: 'pointer'
}

const showAllButtonStyle: React.CSSProperties = {
  padding: '6px 0',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  background: 'none',
  color: 'var(--accent-blue)',
  cursor: 'pointer',
  textAlign: 'center'
}
