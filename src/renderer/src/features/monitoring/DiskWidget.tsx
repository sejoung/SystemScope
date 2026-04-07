import { Accordion } from '../../components/Accordion'
import { useCompactLayout, useContainerWidth } from '../../hooks/useContainerWidth'
import { useI18n } from '../../i18n/useI18n'
import { useSystemStore } from '../../stores/useSystemStore'

const COMPACT_HEADER_HEIGHT = 108
const DEFAULT_WIDGET_WIDTH = 360

function formatIops(value: number | null): string {
  if (value === null) return 'N/A'
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1)
}

export function DiskWidget() {
  const disk = useSystemStore((s) => s.current?.disk)
  const { tk } = useI18n()
  const [ref, width] = useContainerWidth(DEFAULT_WIDGET_WIDTH)
  const isCompact = useCompactLayout(width)

  if (!disk) {
    return (
      <Accordion title={tk('monitoring.disk.title')} defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tk('monitoring.loading')}</div>
      </Accordion>
    )
  }

  const io = disk.io
  const totalIops = io.totalPerSecond
  const busyPercent = io.busyPercent

  return (
    <Accordion title={tk('monitoring.disk.title')} defaultOpen>
      <div ref={ref}>
      {totalIops === null && busyPercent === null ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
          {tk('monitoring.disk.unavailable')}
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              height: isCompact ? `${COMPACT_HEADER_HEIGHT}px` : '120px',
              padding: isCompact ? '4px 0 0' : '8px 0 4px'
            }}
          >
            <div style={{ fontSize: isCompact ? '28px' : '32px', fontWeight: 700, color: 'var(--accent-cyan)', lineHeight: 1 }}>
              {formatIops(totalIops)}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: isCompact ? '6px' : '8px' }}>
              {tk('monitoring.disk.total_iops')}
            </div>
            {busyPercent !== null && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {tk('monitoring.disk.busy_percent', { value: busyPercent.toFixed(1) })}
              </div>
            )}
          </div>
          <div
            style={{
              marginTop: isCompact ? '10px' : '12px',
              display: 'grid',
              gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : '1fr',
              gap: isCompact ? '8px' : '6px'
            }}
          >
            <InfoRow compact={isCompact} label={tk('monitoring.disk.read_iops')} value={formatIops(io.readsPerSecond)} color="var(--accent-blue)" />
            <InfoRow compact={isCompact} label={tk('monitoring.disk.write_iops')} value={formatIops(io.writesPerSecond)} color="var(--accent-purple)" />
            <InfoRow compact={isCompact} label={tk('monitoring.disk.total_iops')} value={formatIops(totalIops)} color="var(--accent-cyan)" />
            {busyPercent !== null && (
              <InfoRow compact={isCompact} label={tk('monitoring.disk.busy')} value={`${busyPercent.toFixed(1)}%`} />
            )}
          </div>
        </>
      )}
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
