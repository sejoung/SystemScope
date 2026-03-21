import type { ProcessInfo } from '@shared/types'
import { Card } from '../../components/Card'
import { ProgressBar } from '../../components/ProgressBar'

interface TopProcessesProps {
  processes: ProcessInfo[]
  title: string
  metric: 'cpu' | 'memory'
}

export function TopProcesses({ processes, title, metric }: TopProcessesProps) {
  const top5 = processes.slice(0, 5)

  return (
    <Card title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {top5.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>데이터 로딩 중...</div>
        )}
        {top5.map((p) => (
          <ProgressBar
            key={p.pid}
            value={metric === 'cpu' ? p.cpu : p.memory}
            label={p.name}
            height={6}
            color={
              (metric === 'cpu' ? p.cpu : p.memory) > 50
                ? 'var(--accent-red)'
                : 'var(--accent-blue)'
            }
          />
        ))}
      </div>
    </Card>
  )
}
