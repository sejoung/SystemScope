import { useSystemStore } from '../../stores/useSystemStore'
import { Card } from '../../components/Card'
import { GaugeChart } from '../../components/GaugeChart'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function GpuWidget() {
  const gpu = useSystemStore((s) => s.current?.gpu)

  if (!gpu) {
    return (
      <Card title="GPU">
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>데이터 로딩 중...</div>
      </Card>
    )
  }

  if (!gpu.available) {
    return (
      <Card title="GPU">
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
          GPU를 감지할 수 없습니다
        </div>
      </Card>
    )
  }

  const memUsage =
    gpu.memoryTotal && gpu.memoryUsed
      ? Math.round((gpu.memoryUsed / gpu.memoryTotal) * 10000) / 100
      : null

  return (
    <Card title="GPU">
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
    </Card>
  )
}
