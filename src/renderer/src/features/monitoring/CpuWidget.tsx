import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { GaugeChart } from '../../components/GaugeChart'
import { ProgressBar } from '../../components/ProgressBar'

export function CpuWidget() {
  const cpu = useSystemStore((s) => s.current?.cpu)

  if (!cpu) {
    return (
      <Accordion title="CPU" defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>데이터 로딩 중...</div>
      </Accordion>
    )
  }

  return (
    <Accordion title="CPU" defaultOpen>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        <GaugeChart
          value={cpu.usage}
          label="Usage"
          color={cpu.usage > 80 ? 'var(--accent-red)' : cpu.usage > 50 ? 'var(--accent-yellow)' : 'var(--accent-green)'}
          subtitle={cpu.model}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Cores ({cpu.cores.length}) @ {cpu.speed} GHz
            {cpu.temperature !== null && ` / ${cpu.temperature}°C`}
          </div>
          {cpu.cores.slice(0, 8).map((core, i) => (
            <ProgressBar
              key={i}
              value={core}
              label={`Core ${i}`}
              height={4}
              color={core > 80 ? 'var(--accent-red)' : 'var(--accent-blue)'}
              showValue={false}
            />
          ))}
          {cpu.cores.length > 8 && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              +{cpu.cores.length - 8} more cores
            </div>
          )}
        </div>
      </div>
    </Accordion>
  )
}
