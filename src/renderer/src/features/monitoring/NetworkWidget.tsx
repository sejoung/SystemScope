import { Accordion } from '../../components/Accordion'
import { useCompactLayout, useContainerWidth } from '../../hooks/useContainerWidth'
import { useI18n } from '../../i18n/useI18n'
import { useSystemStore } from '../../stores/useSystemStore'
import { formatBytes } from '../../utils/format'

const COMPACT_HEADER_HEIGHT = 108

function formatRate(value: number | null): string {
  if (value === null) return 'N/A'
  return `${formatBytes(value)}/s`
}

function formatTotal(value: number | null): string {
  if (value === null) return 'N/A'
  return formatBytes(value)
}

export function NetworkWidget() {
  const network = useSystemStore((s) => s.current?.network)
  const { tk } = useI18n()
  const [ref, width] = useContainerWidth(280)
  const isCompact = useCompactLayout(width)

  if (!network) {
    return (
      <Accordion title={tk('monitoring.network.title')} defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tk('monitoring.loading')}</div>
      </Accordion>
    )
  }

  const primaryLabel = tk('monitoring.network.download')
  const primaryValue = formatRate(network.downloadBytesPerSecond)

  return (
    <Accordion title={tk('monitoring.network.title')} defaultOpen>
      <div ref={ref}>
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
          <div style={{ fontSize: isCompact ? '28px' : '32px', fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1 }}>
            {primaryValue}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: isCompact ? '6px' : '8px' }}>
            {primaryLabel}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
            {network.interfaces.length > 0 ? network.interfaces.join(', ') : tk('monitoring.network.unavailable')}
          </div>
        </div>
        <div
          style={{
            marginTop: isCompact ? '10px' : '12px',
            display: 'grid',
            gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : '1fr',
            gap: isCompact ? '8px' : '6px'
          }}
        >
          <InfoRow compact={isCompact} label={tk('monitoring.network.download')} value={formatRate(network.downloadBytesPerSecond)} color="var(--accent-blue)" />
          <InfoRow compact={isCompact} label={tk('monitoring.network.upload')} value={formatRate(network.uploadBytesPerSecond)} color="var(--accent-purple)" />
          <InfoRow compact={isCompact} label={tk('monitoring.network.total_download')} value={formatTotal(network.totalDownloadedBytes)} />
          <InfoRow compact={isCompact} label={tk('monitoring.network.total_upload')} value={formatTotal(network.totalUploadedBytes)} />
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
