import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export function RealtimeChart() {
  const history = useSystemStore((s) => s.history)

  const data = history.map((h, i) => ({
    idx: i,
    cpu: h.cpu.usage,
    memory: h.memory.usage,
    gpu: h.gpu.usage ?? 0
  }))

  return (
    <Accordion title="Live Usage" defaultOpen>
      <div style={{ minHeight: '280px' }}>
      {data.length < 2 ? (
        <div
          style={{
            color: 'var(--text-muted)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px'
          }}
        >
          데이터 수집 중...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="idx"
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={{ stroke: 'var(--chart-grid)' }}
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              tickFormatter={(val) => `${val}s`}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={{ stroke: 'var(--chart-grid)' }}
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              tickFormatter={(val) => `${val}%`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: 'var(--chart-tooltip-shadow)',
                color: 'var(--text-primary)',
                fontSize: '12px'
              }}
              formatter={(val: number) => `${val.toFixed(1)}%`}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }} />
            <Line type="monotone" dataKey="cpu" stroke="var(--accent-blue)" strokeWidth={2} dot={false} name="CPU" />
            <Line type="monotone" dataKey="memory" stroke="var(--accent-green)" strokeWidth={2} dot={false} name="Memory" />
            <Line type="monotone" dataKey="gpu" stroke="var(--accent-purple)" strokeWidth={2} dot={false} name="GPU" />
          </LineChart>
        </ResponsiveContainer>
      )}
      </div>
    </Accordion>
  )
}
