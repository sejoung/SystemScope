import { useMemo, useState } from 'react'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { useTimelineStore } from '../../stores/timeline/useTimelineStore'
import { useI18n } from '../../i18n/useI18n'
import type { TimelineData, TimelineRange } from '@shared/types'
import { buildAlertPoints, findClosestPointIndex, type TimelineChartPoint } from './timelineChartModel'

const CHART_HEIGHT = 260
const MARGIN = { top: 14, right: 14, bottom: 32, left: 42 }
const GRID_VALUES = [0, 25, 50, 75, 100]

interface Series {
  key: 'cpu' | 'memory' | 'disk'
  label: string
  color: string
}

function formatTimeAxis(ts: number, range: TimelineRange): string {
  const date = new Date(ts)
  if (range === '24h') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function TimelineChart({ data }: { data: TimelineData }) {
  const range = useTimelineStore((state) => state.range)
  const fetchPointDetail = useTimelineStore((state) => state.fetchPointDetail)
  const [containerRef, width] = useContainerWidth(600)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { tk } = useI18n()
  const chartData = useMemo<TimelineChartPoint[]>(() => data.points.map((point) => ({
    ts: point.ts,
    cpu: point.cpu,
    memory: point.memory,
    disk: point.diskUsagePercent,
  })), [data.points])
  const alertPoints = useMemo(() => buildAlertPoints(data.points, data.alerts), [data.alerts, data.points])
  const series = useMemo<Series[]>(() => [
    { key: 'cpu', label: tk('timeline.chart.cpu'), color: 'var(--accent-blue)' },
    { key: 'memory', label: tk('timeline.chart.memory'), color: 'var(--accent-green)' },
    { key: 'disk', label: tk('timeline.chart.disk'), color: 'var(--accent-orange)' },
  ], [tk])

  if (chartData.length < 2) return <div style={emptyStyle}>{tk('timeline.empty')}</div>

  return (
    <div ref={containerRef} style={{ minHeight: '280px' }}>
      {width > 0 ? (
        <LightweightTimelineChart
          data={chartData}
          alerts={alertPoints}
          series={series}
          range={range}
          width={width}
          hoveredIndex={hoveredIndex}
          onHoveredIndexChange={setHoveredIndex}
          onSelect={(timestamp) => { void fetchPointDetail(timestamp) }}
        />
      ) : null}
    </div>
  )
}

function LightweightTimelineChart({ data, alerts, series, range, width, hoveredIndex, onHoveredIndexChange, onSelect }: {
  data: TimelineChartPoint[]
  alerts: ReturnType<typeof buildAlertPoints>
  series: Series[]
  range: TimelineRange
  width: number
  hoveredIndex: number | null
  onHoveredIndexChange: (index: number | null) => void
  onSelect: (timestamp: number) => void
}) {
  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right)
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom
  const firstTimestamp = data[0].ts
  const timeSpan = Math.max(1, data[data.length - 1].ts - firstTimestamp)
  const xForTimestamp = (timestamp: number): number => MARGIN.left + ((timestamp - firstTimestamp) / timeSpan) * plotWidth
  const yFor = (value: number): number => MARGIN.top + (1 - Math.max(0, Math.min(100, value)) / 100) * plotHeight
  const hovered = hoveredIndex === null ? null : data[hoveredIndex]
  const tickTimestamps = [firstTimestamp, firstTimestamp + timeSpan / 2, firstTimestamp + timeSpan]
  const polylines = useMemo(() => series.map((item) => ({
    ...item,
    points: data.map((point) => `${xForTimestamp(point.ts)},${yFor(point[item.key])}`).join(' '),
  })), [data, series, timeSpan, width])

  const indexFromPointer = (event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>): number => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const plotX = Math.max(0, Math.min(plotWidth, event.clientX - bounds.left - MARGIN.left))
    return findClosestPointIndex(data, firstTimestamp + (plotX / plotWidth) * timeSpan)
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width={width}
        height={CHART_HEIGHT}
        role="img"
        aria-label="CPU, memory, and disk usage timeline"
        style={{ cursor: 'pointer' }}
        onPointerMove={(event) => onHoveredIndexChange(indexFromPointer(event))}
        onPointerLeave={() => onHoveredIndexChange(null)}
        onClick={(event) => onSelect(data[indexFromPointer(event)].ts)}
      >
        {GRID_VALUES.map((value) => {
          const y = yFor(value)
          return <g key={value}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <text x={MARGIN.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{value}%</text>
          </g>
        })}
        {polylines.map((item) => (
          <polyline key={item.key} points={item.points} fill="none" stroke={item.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
        {alerts.map((alert, index) => (
          <circle key={`${alert.ts}-${index}`} cx={xForTimestamp(alert.ts)} cy={yFor(alert.cpu)} r="5" fill={alert.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-yellow)'}>
            <title>{alert.message}</title>
          </circle>
        ))}
        {tickTimestamps.map((timestamp, index) => (
          <text key={timestamp} x={xForTimestamp(timestamp)} y={CHART_HEIGHT - 8} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'} fontSize="10" fill="var(--text-secondary)">
            {formatTimeAxis(timestamp, range)}
          </text>
        ))}
        {hoveredIndex !== null && <line x1={xForTimestamp(data[hoveredIndex].ts)} x2={xForTimestamp(data[hoveredIndex].ts)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="var(--text-muted)" strokeDasharray="2 2" />}
      </svg>
      {hovered ? (
        <div style={{ ...tooltipStyle, left: Math.max(0, Math.min(width - 170, xForTimestamp(hovered.ts) + 8)) }}>
          <div style={{ color: 'var(--text-primary)', marginBottom: '3px' }}>{new Date(hovered.ts).toLocaleString()}</div>
          {series.map((item) => <div key={item.key} style={{ color: item.color }}>{item.label}: {hovered[item.key].toFixed(1)}%</div>)}
        </div>
      ) : null}
      <div style={legendStyle}>
        {series.map((item) => <span key={item.key}><span style={{ color: item.color }}>●</span> {item.label}</span>)}
      </div>
    </div>
  )
}

const emptyStyle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '260px' }
const tooltipStyle: React.CSSProperties = { position: 'absolute', top: 16, padding: '7px 9px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--chart-tooltip-bg)', boxShadow: 'var(--chart-tooltip-shadow)', fontSize: '11px', pointerEvents: 'none' }
const legendStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: '14px', color: 'var(--text-secondary)', fontSize: '11px' }
