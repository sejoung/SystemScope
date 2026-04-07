import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { GaugeChart } from '../../components/GaugeChart'
import { useCompactLayout, useContainerWidth } from '../../hooks/useContainerWidth'
import { formatBytes } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const COMPACT_HEADER_HEIGHT = 108
const DEFAULT_WIDGET_WIDTH = 360

export function MemoryWidget() {
  const memory = useSystemStore((s) => s.current?.memory)
  const { tk } = useI18n()
  const [ref, width] = useContainerWidth(DEFAULT_WIDGET_WIDTH)
  const isCompact = useCompactLayout(width)

  if (!memory) {
    return (
      <Accordion title={tk('monitoring.memory.title')} defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tk('monitoring.loading')}</div>
      </Accordion>
    )
  }

  const color = memory.usage > 90 ? 'var(--accent-red)' : memory.usage > 70 ? 'var(--accent-yellow)' : 'var(--accent-green)'

  return (
    <Accordion title={tk('monitoring.memory.title')} defaultOpen>
      <div ref={ref}>
        {isCompact ? (
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
            <div style={{ fontSize: '28px', fontWeight: 700, color, lineHeight: 1 }}>
              {memory.usage.toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '6px' }}>
              {tk('monitoring.memory.pressure')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {tk('monitoring.memory.real_pressure')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {formatBytes(memory.used)} / {formatBytes(memory.total)}
            </div>
          </div>
        ) : (
          <GaugeChart
            value={memory.usage}
            label={tk('monitoring.memory.pressure')}
            color={color}
            subtitle={tk('monitoring.memory.real_pressure')}
            size={120}
          />
        )}
        <div
          style={{
            marginTop: '12px',
            display: 'grid',
            gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : '1fr',
            gap: isCompact ? '8px' : '6px'
          }}
        >
          <InfoRow compact={isCompact} label={tk('monitoring.memory.used')} value={formatBytes(memory.used)} color={color} />
          <InfoRow compact={isCompact} label={tk('monitoring.memory.active')} value={formatBytes(memory.active)} color="var(--accent-blue)" />
          <InfoRow compact={isCompact} label={tk('monitoring.memory.cached')} value={formatBytes(memory.cached)} color="var(--text-muted)" />
          <InfoRow compact={isCompact} label={tk('monitoring.memory.available')} value={formatBytes(memory.available)} color="var(--accent-green)" />
          <InfoRow compact={isCompact} label={tk('monitoring.memory.total')} value={formatBytes(memory.total)} />
          {memory.swapTotal > 0 && (
            <InfoRow compact={isCompact} label={tk('monitoring.memory.swap')} value={`${formatBytes(memory.swapUsed)} / ${formatBytes(memory.swapTotal)}`} />
          )}
        </div>
      </div>
    </Accordion>
  )
}

function InfoRow({ label, value, color, compact = false }: { label: string; value: string; color?: string; compact?: boolean }) {
  if (compact) {
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

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color ?? 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
