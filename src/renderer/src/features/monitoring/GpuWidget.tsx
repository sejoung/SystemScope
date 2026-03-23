import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { GaugeChart } from '../../components/GaugeChart'
import { formatBytes } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

export function GpuWidget() {
  const gpu = useSystemStore((s) => s.current?.gpu)
  const { tk } = useI18n()

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

  // Apple Silicon: 모델은 감지되지만 사용률/VRAM 데이터 없음
  if (!hasUsageData) {
    return (
      <Accordion title={tk('monitoring.gpu.title')} defaultOpen>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {gpu.model}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            {tk('monitoring.gpu.apple_silicon')}
          </div>
        </div>
      </Accordion>
    )
  }

  const memUsage =
    gpu.memoryTotal && gpu.memoryUsed
      ? Math.round((gpu.memoryUsed / gpu.memoryTotal) * 10000) / 100
      : null

  return (
    <Accordion title={tk('monitoring.gpu.title')} defaultOpen>
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
    </Accordion>
  )
}
