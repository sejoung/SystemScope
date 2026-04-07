import { Accordion } from '../../components/Accordion'
import { useI18n } from '../../i18n/useI18n'
import { useSystemStore } from '../../stores/useSystemStore'
import { formatBytes } from '../../utils/format'

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
      <div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '120px',
            padding: '8px 0 4px'
          }}
        >
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1 }}>
            {primaryValue}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '8px' }}>
            {primaryLabel}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
            {network.interfaces.length > 0 ? network.interfaces.join(', ') : tk('monitoring.network.unavailable')}
          </div>
        </div>
        <div
          style={{
            marginTop: '12px',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '6px'
          }}
        >
          <InfoRow label={tk('monitoring.network.download')} value={formatRate(network.downloadBytesPerSecond)} color="var(--accent-blue)" />
          <InfoRow label={tk('monitoring.network.upload')} value={formatRate(network.uploadBytesPerSecond)} color="var(--accent-purple)" />
          <InfoRow label={tk('monitoring.network.total_download')} value={formatTotal(network.totalDownloadedBytes)} />
          <InfoRow label={tk('monitoring.network.total_upload')} value={formatTotal(network.totalUploadedBytes)} />
        </div>
      </div>
    </Accordion>
  )
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color ?? 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
