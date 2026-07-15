import { useMemo, useState } from 'react'
import { useSystemStore } from '../../stores/system/useSystemStore'
import { Accordion } from '../../components/ui/Accordion'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { useI18n } from '../../i18n/useI18n'

const CHART_HEIGHT = 220
const MARGIN = { top: 12, right: 12, bottom: 26, left: 38 }
const GRID_VALUES = [0, 25, 50, 75, 100]

interface ChartPoint {
  cpu: number
  memory: number
  gpu: number
}

interface Series {
  key: keyof ChartPoint
  label: string
  color: string
}

export function RealtimeChart() {
  const history = useSystemStore((state) => state.history)
  const [containerRef, width] = useContainerWidth(600)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { tk } = useI18n()
  const data = useMemo<ChartPoint[]>(() => history.map((stats) => ({
    cpu: stats.cpu.usage,
    memory: stats.memory.usage,
    gpu: stats.gpu?.usage ?? 0,
  })), [history])
  const series: Series[] = [
    { key: 'cpu', label: tk('monitoring.cpu.title'), color: 'var(--accent-blue)' },
    { key: 'memory', label: tk('settings.alerts.memory'), color: 'var(--accent-green)' },
    { key: 'gpu', label: tk('monitoring.gpu.title'), color: 'var(--accent-purple)' },
  ]

  return (
    <Accordion title={tk('monitoring.live_usage.title')} defaultOpen>
      <div ref={containerRef} style={{ minHeight: '260px' }}>
        {data.length < 2 ? <EmptyChart message={tk('monitoring.collecting')} /> : width > 0 ? (
          <LightweightLineChart
            data={data}
            series={series}
            width={width}
            hoveredIndex={hoveredIndex}
            onHoveredIndexChange={setHoveredIndex}
          />
        ) : null}
      </div>
    </Accordion>
  )
}

function LightweightLineChart({ data, series, width, hoveredIndex, onHoveredIndexChange }: {
  data: ChartPoint[]
  series: Series[]
  width: number
  hoveredIndex: number | null
  onHoveredIndexChange: (index: number | null) => void
}) {
  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right)
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom
  const xFor = (index: number): number => MARGIN.left + (index / Math.max(1, data.length - 1)) * plotWidth
  const yFor = (value: number): number => MARGIN.top + (1 - Math.max(0, Math.min(100, value)) / 100) * plotHeight
  const hovered = hoveredIndex === null ? null : data[hoveredIndex]

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const plotX = Math.max(0, Math.min(plotWidth, event.clientX - bounds.left - MARGIN.left))
    onHoveredIndexChange(Math.round((plotX / plotWidth) * (data.length - 1)))
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width={width}
        height={CHART_HEIGHT}
        role="img"
        aria-label="Live CPU, memory, and GPU usage"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => onHoveredIndexChange(null)}
      >
        {GRID_VALUES.map((value) => {
          const y = yFor(value)
          return <g key={value}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <text x={MARGIN.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{value}%</text>
          </g>
        })}
        {series.map((item) => (
          <polyline
            key={item.key}
            points={data.map((point, index) => `${xFor(index)},${yFor(point[item.key])}`).join(' ')}
            fill="none"
            stroke={item.color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <text x={MARGIN.left} y={CHART_HEIGHT - 7} fontSize="10" fill="var(--text-secondary)">0s</text>
        <text x={width - MARGIN.right} y={CHART_HEIGHT - 7} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{data.length - 1}s</text>
        {hoveredIndex !== null && <line x1={xFor(hoveredIndex)} x2={xFor(hoveredIndex)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="var(--text-muted)" strokeDasharray="2 2" />}
      </svg>
      {hovered && <div style={{ ...tooltipStyle, left: Math.max(0, Math.min(width - 150, xFor(hoveredIndex ?? 0) + 8)) }}>
        {series.map((item) => <div key={item.key} style={{ color: item.color }}>{item.label}: {hovered[item.key].toFixed(1)}%</div>)}
      </div>}
      <div style={legendStyle}>
        {series.map((item) => <span key={item.key}><span style={{ color: item.color }}>●</span> {item.label}</span>)}
      </div>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return <div style={emptyStyle}>{message}</div>
}

const emptyStyle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }
const tooltipStyle: React.CSSProperties = { position: 'absolute', top: 16, padding: '7px 9px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--chart-tooltip-bg)', boxShadow: 'var(--chart-tooltip-shadow)', fontSize: '11px', pointerEvents: 'none' }
const legendStyle: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: '14px', color: 'var(--text-secondary)', fontSize: '11px' }
