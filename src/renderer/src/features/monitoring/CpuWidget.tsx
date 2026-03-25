import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { GaugeChart } from '../../components/GaugeChart'
import { ProgressBar } from '../../components/ProgressBar'
import { useI18n } from '../../i18n/useI18n'

export function CpuWidget() {
  const cpu = useSystemStore((s) => s.current?.cpu)
  const { tk } = useI18n()

  if (!cpu) {
    return (
      <Accordion title={tk('monitoring.cpu.title')} defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tk('monitoring.loading')}</div>
      </Accordion>
    )
  }

  return (
    <Accordion title={tk('monitoring.cpu.title')} defaultOpen>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        <GaugeChart
          value={cpu.usage}
          label={tk('monitoring.cpu.usage')}
          color={cpu.usage > 80 ? 'var(--accent-red)' : cpu.usage > 50 ? 'var(--accent-yellow)' : 'var(--accent-green)'}
          subtitle={cpu.model}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            {tk('monitoring.cpu.cores', { count: cpu.cores.length, speed: cpu.speed })}
            {cpu.temperature !== null && ` / ${cpu.temperature}°C`}
          </div>
          {cpu.cores.slice(0, 8).map((core, coreIndex) => (
            <ProgressBar
              key={`core-${coreIndex}`}
              value={core}
              label={`Core ${coreIndex}`}
              height={4}
              color={core > 80 ? 'var(--accent-red)' : 'var(--accent-blue)'}
              showValue={false}
            />
          ))}
          {cpu.cores.length > 8 && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {tk('monitoring.cpu.more_cores', { count: cpu.cores.length - 8 })}
            </div>
          )}
        </div>
      </div>
    </Accordion>
  )
}
