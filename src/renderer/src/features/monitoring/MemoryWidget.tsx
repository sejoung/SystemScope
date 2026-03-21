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

export function MemoryWidget() {
  const memory = useSystemStore((s) => s.current?.memory)

  if (!memory) {
    return (
      <Card title="Memory">
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>데이터 로딩 중...</div>
      </Card>
    )
  }

  const color = memory.usage > 90 ? 'var(--accent-red)' : memory.usage > 70 ? 'var(--accent-yellow)' : 'var(--accent-green)'

  return (
    <Card title="Memory">
      <GaugeChart value={memory.usage} label="Pressure" color={color} subtitle="실제 메모리 압박도" />
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <InfoRow label="Active" value={formatBytes(memory.active)} color="var(--accent-blue)" />
        <InfoRow label="Cached" value={formatBytes(memory.cached)} color="var(--text-muted)" />
        <InfoRow label="Available" value={formatBytes(memory.available)} color="var(--accent-green)" />
        <InfoRow label="Total" value={formatBytes(memory.total)} />
        {memory.swapTotal > 0 && (
          <InfoRow label="Swap" value={`${formatBytes(memory.swapUsed)} / ${formatBytes(memory.swapTotal)}`} />
        )}
      </div>
    </Card>
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
