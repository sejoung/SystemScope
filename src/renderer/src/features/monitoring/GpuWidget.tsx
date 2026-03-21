import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { GaugeChart } from '../../components/GaugeChart'
import { formatBytes } from '../../utils/format'

export function GpuWidget() {
  const gpu = useSystemStore((s) => s.current?.gpu)

  if (!gpu) {
    return (
      <Accordion title="GPU" defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>데이터 로딩 중...</div>
      </Accordion>
    )
  }

  if (!gpu.available) {
    return (
      <Accordion title="GPU" defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
          GPU를 감지할 수 없습니다
        </div>
      </Accordion>
    )
  }

  const hasUsageData = gpu.usage !== null || (gpu.memoryTotal !== null && gpu.memoryUsed !== null)

  // Apple Silicon: 모델은 감지되지만 사용률/VRAM 데이터 없음
  if (!hasUsageData) {
    return (
      <Accordion title="GPU" defaultOpen>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {gpu.model}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Apple Silicon은 CPU와 통합 메모리(Unified Memory)를
            <br />
            공유하여 별도 GPU 사용률 모니터링이 제공되지 않습니다.
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
    <Accordion title="GPU" defaultOpen>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        {gpu.usage !== null && (
          <GaugeChart
            value={gpu.usage}
            label="Utilization"
            color={gpu.usage > 80 ? 'var(--accent-red)' : 'var(--accent-purple)'}
            size={100}
          />
        )}
        {memUsage !== null && (
          <GaugeChart
            value={memUsage}
            label="VRAM"
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
