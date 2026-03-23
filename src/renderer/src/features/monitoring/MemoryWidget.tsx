import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { GaugeChart } from '../../components/GaugeChart'
import { formatBytes } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

export function MemoryWidget() {
  const memory = useSystemStore((s) => s.current?.memory)
  const { t } = useI18n()

  if (!memory) {
    return (
      <Accordion title={t('Memory')} defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('데이터 로딩 중...')}</div>
      </Accordion>
    )
  }

  const color = memory.usage > 90 ? 'var(--accent-red)' : memory.usage > 70 ? 'var(--accent-yellow)' : 'var(--accent-green)'

  return (
    <Accordion title={t('Memory')} defaultOpen>
      <GaugeChart value={memory.usage} label={t('Pressure')} color={color} subtitle={t('실제 메모리 압박도')} />
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <InfoRow label={t('Active')} value={formatBytes(memory.active)} color="var(--accent-blue)" />
        <InfoRow label={t('Cached')} value={formatBytes(memory.cached)} color="var(--text-muted)" />
        <InfoRow label={t('Available')} value={formatBytes(memory.available)} color="var(--accent-green)" />
        <InfoRow label={t('Total')} value={formatBytes(memory.total)} />
        {memory.swapTotal > 0 && (
          <InfoRow label={t('Swap')} value={`${formatBytes(memory.swapUsed)} / ${formatBytes(memory.swapTotal)}`} />
        )}
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
