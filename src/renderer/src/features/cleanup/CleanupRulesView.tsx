import { useEffect, useState } from 'react'
import { useCleanupStore } from '../../stores/useCleanupStore'
import { useI18n } from '../../i18n/useI18n'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { CleanupPreviewDialog } from './CleanupPreviewDialog'
import type { CleanupRule } from '@shared/types'

const CATEGORY_ORDER = ['downloads', 'dev_tools', 'package_managers', 'docker', 'system'] as const

const CATEGORY_LABELS: Record<string, string> = {
  downloads: 'Downloads',
  dev_tools: 'Dev Tools',
  package_managers: 'Package Managers',
  docker: 'Docker',
  system: 'System',
}

export function CleanupRulesView() {
  const rules = useCleanupStore((s) => s.rules)
  const rulesLoading = useCleanupStore((s) => s.rulesLoading)
  const previewLoading = useCleanupStore((s) => s.previewLoading)
  const preview = useCleanupStore((s) => s.preview)
  const fetchRules = useCleanupStore((s) => s.fetchRules)
  const toggleRule = useCleanupStore((s) => s.toggleRule)
  const updateRuleMinAge = useCleanupStore((s) => s.updateRuleMinAge)
  const runPreview = useCleanupStore((s) => s.runPreview)
  const { tk, t } = useI18n()

  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    void fetchRules()
  }, [fetchRules])

  const handlePreview = async () => {
    await runPreview()
    setShowPreview(true)
  }

  // Group rules by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, CleanupRule[]>>((acc, cat) => {
    const catRules = rules.filter((r) => r.category === cat)
    if (catRules.length > 0) acc[cat] = catRules
    return acc
  }, {})

  return (
    <ErrorBoundary title={tk('cleanup.rules.title')}>
      <div style={{ display: 'grid', gap: '16px' }}>
        {rulesLoading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            {t('Loading...')}
          </div>
        )}

        {!rulesLoading && rules.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
            {tk('cleanup.rules.empty')}
          </div>
        )}

        {!rulesLoading && Object.entries(grouped).map(([category, catRules]) => (
          <div key={category} style={{ display: 'grid', gap: '8px' }}>
            <h3 style={sectionHeaderStyle}>
              {t(CATEGORY_LABELS[category] ?? category)}
            </h3>
            {catRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={(enabled) => void toggleRule(rule.id, enabled)}
                onMinAgeChange={(days) => void updateRuleMinAge(rule.id, days)}
              />
            ))}
          </div>
        ))}

        {!rulesLoading && rules.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={previewLoading}
              style={previewBtnStyle}
            >
              {previewLoading ? tk('cleanup.preview.scanning') : tk('cleanup.preview.title')}
            </button>
          </div>
        )}
      </div>

      {showPreview && preview && (
        <CleanupPreviewDialog
          preview={preview}
          onClose={() => setShowPreview(false)}
        />
      )}
    </ErrorBoundary>
  )
}

function RuleCard({
  rule,
  onToggle,
  onMinAgeChange,
}: {
  rule: CleanupRule
  onToggle: (enabled: boolean) => void
  onMinAgeChange: (days: number) => void
}) {
  const { t } = useI18n()

  return (
    <div style={ruleCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          onClick={() => onToggle(!rule.enabled)}
          style={{
            ...toggleBaseStyle,
            background: rule.enabled ? 'var(--accent-blue)' : 'var(--bg-secondary)',
            border: rule.enabled ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
          }}
        >
          <span style={{
            ...toggleKnobStyle,
            transform: rule.enabled ? 'translateX(14px)' : 'translateX(0)',
          }} />
        </button>

        <div style={{ flex: 1, display: 'grid', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {rule.name}
            </span>
            <span style={categoryBadgeStyle}>
              {rule.category}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {rule.description}
          </span>
        </div>
      </div>

      {/* Min age setting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '44px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {t('Min age')}:
        </span>
        <input
          type="number"
          min={0}
          max={365}
          value={rule.minAgeDays}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (!isNaN(val) && val >= 0) onMinAgeChange(val)
          }}
          style={numberInputStyle}
        />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {t('days')}
        </span>
      </div>

      {/* Target paths (read-only) */}
      {rule.targetPaths.length > 0 && (
        <div style={{ paddingLeft: '44px', display: 'grid', gap: '2px' }}>
          {rule.targetPaths.map((p) => (
            <span key={p} style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: 0,
  padding: '8px 0 0',
}

const ruleCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '14px 16px',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
}

const toggleBaseStyle: React.CSSProperties = {
  position: 'relative',
  width: '34px',
  height: '20px',
  borderRadius: '999px',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.15s ease, border 0.15s ease',
  padding: 0,
}

const toggleKnobStyle: React.CSSProperties = {
  position: 'absolute',
  top: '2px',
  left: '2px',
  width: '14px',
  height: '14px',
  borderRadius: '999px',
  background: '#fff',
  transition: 'transform 0.15s ease',
  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
}

const categoryBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: '999px',
  background: 'var(--bg-secondary)',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const numberInputStyle: React.CSSProperties = {
  width: '60px',
  padding: '4px 8px',
  fontSize: '12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  textAlign: 'center',
}

const previewBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  fontSize: '13px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '8px',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer',
}
