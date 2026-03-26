import { useMemo } from 'react'
import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useI18n } from '../../i18n/useI18n'

export function RealtimeChart() {
  const history = useSystemStore((s) => s.history)
  const [ref, width] = useContainerWidth(600)
  const { tk } = useI18n()

  const data = useMemo(() => history.map((h, i) => ({
    idx: i,
    cpu: h.cpu.usage,
    memory: h.memory.usage,
    gpu: h.gpu?.usage ?? 0,
    iops: h.disk.io.totalPerSecond ?? 0
  })), [history])

  return (
    <Accordion title={tk('monitoring.live_usage.title')} defaultOpen>
      <div ref={ref} style={{ minHeight: '260px' }}>
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
          {tk('monitoring.collecting')}
        </div>
      ) : width > 0 ? (
          <LineChart data={data} width={width} height={220}>
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
            <YAxis
              yAxisId="iops"
              orientation="right"
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={{ stroke: 'var(--chart-grid)' }}
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              tickFormatter={(val) => `${val}`}
              width={48}
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
              formatter={(value, name) => {
                const numericValue = typeof value === 'number' ? value : 0
                return name === tk('monitoring.disk.total_iops')
                  ? numericValue.toFixed(1)
                  : `${numericValue.toFixed(1)}%`
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }} />
            <Line isAnimationActive={false} type="monotone" dataKey="cpu" stroke="var(--accent-blue)" strokeWidth={2} dot={false} name={tk('monitoring.cpu.title')} />
            <Line isAnimationActive={false} type="monotone" dataKey="memory" stroke="var(--accent-green)" strokeWidth={2} dot={false} name={tk('settings.alerts.memory')} />
            <Line isAnimationActive={false} type="monotone" dataKey="gpu" stroke="var(--accent-purple)" strokeWidth={2} dot={false} name={tk('monitoring.gpu.title')} />
            <Line isAnimationActive={false} yAxisId="iops" type="monotone" dataKey="iops" stroke="var(--accent-cyan)" strokeWidth={2} dot={false} name={tk('monitoring.disk.total_iops')} />
          </LineChart>
      ) : null}
      </div>
    </Accordion>
  )
}
