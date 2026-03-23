import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { GaugeChart } from '../../components/GaugeChart'
import { formatBytes } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

export function MemoryWidget() {
  const memory = useSystemStore((s) => s.current?.memory)
  const { tk } = useI18n()

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
      <GaugeChart value={memory.usage} label={tk('monitoring.memory.pressure')} color={color} subtitle={tk('monitoring.memory.real_pressure')} />
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <InfoRow label={tk('monitoring.memory.active')} value={formatBytes(memory.active)} color="var(--accent-blue)" />
        <InfoRow label={tk('monitoring.memory.cached')} value={formatBytes(memory.cached)} color="var(--text-muted)" />
        <InfoRow label={tk('monitoring.memory.available')} value={formatBytes(memory.available)} color="var(--accent-green)" />
        <InfoRow label={tk('monitoring.memory.total')} value={formatBytes(memory.total)} />
        {memory.swapTotal > 0 && (
          <InfoRow label={tk('monitoring.memory.swap')} value={`${formatBytes(memory.swapUsed)} / ${formatBytes(memory.swapTotal)}`} />
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
