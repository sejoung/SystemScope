import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { GaugeChart } from '../../components/GaugeChart'
import { useCompactLayout, useContainerWidth } from '../../hooks/useContainerWidth'
import { formatBytes } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const COMPACT_HEADER_HEIGHT = 108

export function GpuWidget() {
  const gpu = useSystemStore((s) => s.current?.gpu)
  const { tk } = useI18n()
  const [ref, width] = useContainerWidth(280)
  const isCompact = useCompactLayout(width)

  if (!gpu) {
    return (
      <Accordion title={tk('monitoring.gpu.title')} defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tk('monitoring.loading')}</div>
      </Accordion>
    )
  }

  if (!gpu.available) {
    return (
      <Accordion title={tk('monitoring.gpu.title')} defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
          {tk('monitoring.gpu.missing')}
        </div>
      </Accordion>
    )
  }

  const hasUsageData = gpu.usage !== null || (gpu.memoryTotal !== null && gpu.memoryUsed !== null)
  const unavailableMessage =
    gpu.unavailableReason === 'apple_silicon'
      ? tk('monitoring.gpu.apple_silicon')
      : gpu.unavailableReason === 'virtual_adapter'
        ? tk('monitoring.gpu.virtual_adapter')
        : tk('monitoring.gpu.metrics_unavailable')

  if (!hasUsageData) {
    return (
      <Accordion title={tk('monitoring.gpu.title')} defaultOpen>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {gpu.model}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            {unavailableMessage}
          </div>
        </div>
      </Accordion>
    )
  }

  const memUsage =
    gpu.memoryTotal && gpu.memoryUsed
      ? Math.round((gpu.memoryUsed / gpu.memoryTotal) * 10000) / 100
      : null
  const primaryValue = gpu.usage ?? memUsage
  const primaryColor =
    primaryValue !== null && primaryValue > 80
      ? 'var(--accent-red)'
      : gpu.usage !== null
        ? 'var(--accent-purple)'
        : 'var(--accent-cyan)'

  return (
    <Accordion title={tk('monitoring.gpu.title')} defaultOpen>
      <div ref={ref}>
        {isCompact ? (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                height: `${COMPACT_HEADER_HEIGHT}px`,
                padding: '4px 0 0'
              }}
            >
              <div style={{ fontSize: '28px', fontWeight: 700, color: primaryColor, lineHeight: 1 }}>
                {primaryValue !== null ? `${primaryValue.toFixed(1)}%` : gpu.model}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '6px' }}>
                {gpu.usage !== null ? tk('monitoring.gpu.utilization') : tk('monitoring.gpu.vram')}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
                {gpu.model}
                {gpu.temperature !== null && ` / ${gpu.temperature}°C`}
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              {gpu.usage !== null && (
                <InfoRow label={tk('monitoring.gpu.utilization')} value={`${gpu.usage.toFixed(1)}%`} color="var(--accent-purple)" />
              )}
              {memUsage !== null && (
                <InfoRow label={tk('monitoring.gpu.vram')} value={`${memUsage.toFixed(1)}%`} color="var(--accent-cyan)" />
              )}
              {gpu.memoryTotal !== null && (
                <InfoRow label={tk('monitoring.gpu.memory_total')} value={formatBytes(gpu.memoryTotal)} />
              )}
              {gpu.temperature !== null && (
                <InfoRow label={tk('monitoring.gpu.temperature')} value={`${gpu.temperature.toFixed(1)}°C`} />
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '16px',
              justifyContent: 'center'
            }}
          >
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              {gpu.usage !== null && (
                <GaugeChart
                  value={gpu.usage}
                  label={tk('monitoring.gpu.utilization')}
                  color={gpu.usage > 80 ? 'var(--accent-red)' : 'var(--accent-purple)'}
                  size={100}
                />
              )}
              {memUsage !== null && (
                <GaugeChart
                  value={memUsage}
                  label={tk('monitoring.gpu.vram')}
                  color={memUsage > 80 ? 'var(--accent-red)' : 'var(--accent-cyan)'}
                  size={100}
                  subtitle={gpu.memoryTotal ? formatBytes(gpu.memoryTotal) : undefined}
                />
              )}
            </div>
            <div style={{ marginTop: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {gpu.model}
                {gpu.temperature !== null && ` / ${gpu.temperature}°C`}
              </div>
            </div>
          </div>
        )}
      </div>
    </Accordion>
  )
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '2px',
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'color-mix(in srgb, var(--bg-card-hover) 72%, transparent)',
        minWidth: 0
      }}
    >
      <span style={{ color: 'var(--text-muted)', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: color ?? 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>{value}</span>
    </div>
  )
}
