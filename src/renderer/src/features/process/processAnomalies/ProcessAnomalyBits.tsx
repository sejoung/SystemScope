import { useI18n } from '../../../i18n/useI18n'
import type { ProcessAnomalyKind } from './processAnomalyModel'
import {
  activeFilterButtonStyle,
  anomalyBadgeStyle,
  filterButtonStyle,
  metricLabelStyle,
  metricStyle,
  metricValueStyle
} from './ProcessAnomalyPanel.styles'

export function FilterButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        ...filterButtonStyle,
        ...(active ? activeFilterButtonStyle : {})
      }}
    >
      {children}
    </button>
  )
}

export function AnomalyBadge({ kind }: { kind: ProcessAnomalyKind }) {
  const { tk } = useI18n()
  const labels: Record<ProcessAnomalyKind, string> = {
    zombie: tk('process.anomaly.badge.zombie'),
    sustained_cpu: tk('process.anomaly.badge.sustained_cpu'),
    high_cpu: tk('process.anomaly.badge.high_cpu'),
    long_running: tk('process.anomaly.badge.long_running')
  }

  const critical = kind === 'zombie' || kind === 'sustained_cpu'
  const warning = kind === 'high_cpu'
  return (
    <span style={{
      ...anomalyBadgeStyle,
      color: critical
        ? 'var(--accent-red)'
        : warning
          ? 'var(--accent-yellow)'
          : 'var(--accent-cyan)',
      borderColor: critical
        ? 'var(--alert-red-border)'
        : warning
          ? 'var(--alert-yellow-border)'
          : 'var(--border)'
    }}>
      {labels[kind]}
    </span>
  )
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <span style={metricValueStyle}>{value}</span>
    </div>
  )
}
