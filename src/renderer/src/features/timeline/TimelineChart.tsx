import { useMemo, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
} from 'recharts'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { useTimelineStore } from '../../stores/useTimelineStore'
import { useI18n } from '../../i18n/useI18n'
import type { TimelineData, TimelineRange } from '@shared/types'

function formatTimeAxis(ts: number, range: TimelineRange): string {
  const d = new Date(ts)
  if (range === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

interface TimelineChartProps {
  data: TimelineData
}

export function TimelineChart({ data }: TimelineChartProps) {
  const range = useTimelineStore((s) => s.range)
  const fetchPointDetail = useTimelineStore((s) => s.fetchPointDetail)
  const [ref, width] = useContainerWidth(600)
  const { tk } = useI18n()

  const chartData = useMemo(
    () =>
      data.points.map((p) => ({
        ts: p.ts,
        cpu: p.cpu,
        memory: p.memory,
        disk: p.diskUsagePercent,
      })),
    [data.points],
  )

  const alertPoints = useMemo(
    () =>
      data.alerts.map((a) => {
        const closest = data.points.reduce((prev, curr) =>
          Math.abs(curr.ts - a.ts) < Math.abs(prev.ts - a.ts) ? curr : prev,
        )
        return {
          ts: closest.ts,
          cpu: closest.cpu,
          severity: a.severity,
          message: a.message,
        }
      }),
    [data.alerts, data.points],
  )

  const handleClick = useCallback(
    (payload: Record<string, unknown>) => {
      const active = payload?.activePayload as { payload?: { ts?: number } }[] | undefined
      const ts = active?.[0]?.payload?.ts
      if (typeof ts === 'number') {
        void fetchPointDetail(ts)
      }
    },
    [fetchPointDetail],
  )

  if (chartData.length < 2) {
    return (
      <div
        style={{
          color: 'var(--text-muted)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '260px',
        }}
      >
        {tk('timeline.empty')}
      </div>
    )
  }

  return (
    <div ref={ref} style={{ minHeight: '280px' }}>
      {width > 0 ? (
        <LineChart
          data={chartData}
          width={width}
          height={260}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--chart-grid)"
            vertical={false}
          />
          <XAxis
            dataKey="ts"
            axisLine={{ stroke: 'var(--chart-grid)' }}
            tickLine={{ stroke: 'var(--chart-grid)' }}
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            tickFormatter={(val: number) => formatTimeAxis(val, range)}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={{ stroke: 'var(--chart-grid)' }}
            tickLine={{ stroke: 'var(--chart-grid)' }}
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            tickFormatter={(val: number) => `${val}%`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--chart-tooltip-bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: 'var(--chart-tooltip-shadow)',
              color: 'var(--text-primary)',
              fontSize: '12px',
            }}
            labelFormatter={(label) => {
              const d = new Date(Number(label))
              return d.toLocaleString()
            }}
            formatter={(value) => `${Number(value).toFixed(1)}%`}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="cpu"
            stroke="var(--accent-blue)"
            strokeWidth={2}
            dot={false}
            name={tk('timeline.chart.cpu')}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="memory"
            stroke="var(--accent-green)"
            strokeWidth={2}
            dot={false}
            name={tk('timeline.chart.memory')}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="disk"
            stroke="var(--accent-orange)"
            strokeWidth={2}
            dot={false}
            name={tk('timeline.chart.disk')}
          />
          {alertPoints.map((a, i) => (
            <ReferenceDot
              key={i}
              x={a.ts}
              y={a.cpu}
              r={5}
              fill={a.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-yellow)'}
              stroke="none"
            />
          ))}
        </LineChart>
      ) : null}
    </div>
  )
}
