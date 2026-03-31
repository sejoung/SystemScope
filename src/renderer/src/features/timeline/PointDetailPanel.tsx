import { useTimelineStore } from '../../stores/useTimelineStore'
import { useI18n } from '../../i18n/useI18n'

export function PointDetailPanel() {
  const selectedPoint = useTimelineStore((s) => s.selectedPoint)
  const selectedPointLoading = useTimelineStore((s) => s.selectedPointLoading)
  const clearSelectedPoint = useTimelineStore((s) => s.clearSelectedPoint)
  const { tk } = useI18n()

  if (selectedPointLoading) {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={spinnerStyle} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {tk('timeline.loading')}
          </span>
        </div>
      </div>
    )
  }

  if (!selectedPoint) return null

  const time = new Date(selectedPoint.ts).toLocaleString()

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 700,
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          {tk('timeline.point_detail.title')}
        </h3>
        <button
          type="button"
          onClick={clearSelectedPoint}
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '2px 6px',
            borderRadius: 'var(--radius)',
          }}
          aria-label="Close"
        >
          \u2715
        </button>
      </div>

      {/* Timestamp */}
      <div
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginBottom: '12px',
        }}
      >
        {time}
      </div>

      {/* Metric values */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '16px',
        }}
      >
        <MetricBadge label={tk('timeline.chart.cpu')} value={selectedPoint.cpu} color="var(--accent-blue)" />
        <MetricBadge label={tk('timeline.chart.memory')} value={selectedPoint.memory} color="var(--accent-green)" />
        <MetricBadge label={tk('timeline.chart.disk')} value={selectedPoint.diskUsagePercent} color="var(--accent-orange)" />
        <MetricBadge
          label={tk('timeline.chart.network')}
          value={null}
          detail={`\u2191 ${formatBytes(selectedPoint.networkTxBytesPerSec)}/s  \u2193 ${formatBytes(selectedPoint.networkRxBytesPerSec)}/s`}
          color="var(--accent-cyan)"
        />
        {selectedPoint.gpuUsage !== null && selectedPoint.gpuUsage !== undefined ? (
          <MetricBadge label={tk('timeline.chart.gpu')} value={selectedPoint.gpuUsage} color="var(--accent-purple)" />
        ) : null}
      </div>

      {/* Top Processes */}
      {selectedPoint.topProcesses.length > 0 ? (
        <>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {tk('timeline.point_detail.top_processes')}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Name', 'PID', 'CPU %', 'Mem %'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '4px 8px',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedPoint.topProcesses.map((proc) => (
                  <tr key={proc.pid}>
                    <td style={cellStyle}>{proc.name}</td>
                    <td style={cellStyle}>{proc.pid}</td>
                    <td style={cellStyle}>{proc.cpu.toFixed(1)}%</td>
                    <td style={cellStyle}>{proc.memory.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MetricBadge({
  label,
  value,
  detail,
  color,
}: {
  label: string
  value: number | null
  detail?: string
  color: string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '2px',
        padding: '6px 12px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
        {value !== null && value !== undefined ? `${value.toFixed(1)}%` : detail ?? '-'}
      </span>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const panelStyle: React.CSSProperties = {
  padding: '16px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}

const cellStyle: React.CSSProperties = {
  padding: '4px 8px',
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border)',
}

const spinnerStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  borderRadius: '999px',
  border: '2px solid color-mix(in srgb, var(--accent-blue) 22%, transparent)',
  borderTopColor: 'var(--accent-blue)',
  animation: 'systemscope-spin 0.9s linear infinite',
}
