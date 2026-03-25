import { useMemo } from 'react'
import type { FolderNode } from '@shared/types'
import { formatBytes } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6'
]

interface TreemapChartProps {
  data: FolderNode
  width: number
  height: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
  node: FolderNode
  color: string
}

function layoutTreemap(node: FolderNode, x: number, y: number, w: number, h: number): Rect[] {
  const children = node.children.filter((c) => c.size > 0).slice(0, 20)
  if (children.length === 0) return []

  const total = children.reduce((acc, c) => acc + c.size, 0)
  const rects: Rect[] = []
  let cx = x
  let cy = y
  const isHorizontal = w >= h

  children.forEach((child, i) => {
    const ratio = child.size / total
    const rw = isHorizontal ? w * ratio : w
    const rh = isHorizontal ? h : h * ratio

    rects.push({
      x: cx,
      y: cy,
      w: rw,
      h: rh,
      node: child,
      color: COLORS[i % COLORS.length]
    })

    if (isHorizontal) cx += rw
    else cy += rh
  })

  return rects
}

export function TreemapChart({ data, width, height }: TreemapChartProps) {
  const { tk } = useI18n()
  const rects = useMemo(() => layoutTreemap(data, 0, 0, width, height), [data, width, height])

  if (rects.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px' }}>
        {tk('common.no_data')}
      </div>
    )
  }

  return (
    <svg width={width} height={height} style={{ borderRadius: 'var(--radius)' }}>
      {rects.map((r) => (
        <g key={r.node.path ?? r.node.name}>
          <rect
            x={r.x + 1}
            y={r.y + 1}
            width={Math.max(r.w - 2, 0)}
            height={Math.max(r.h - 2, 0)}
            fill={r.color}
            opacity={0.8}
            rx={4}
          />
          {r.w > 60 && r.h > 30 && (
            <>
              <text
                x={r.x + 6}
                y={r.y + 16}
                fill="var(--text-on-accent)"
                fontSize="11"
                fontWeight="600"
              >
                {(r.node.name ?? '').length > Math.floor(r.w / 7) ? (r.node.name ?? '').slice(0, Math.floor(r.w / 7)) + '...' : r.node.name ?? ''}
              </text>
              <text
                x={r.x + 6}
                y={r.y + 30}
                fill="var(--text-on-accent)"
                fillOpacity="0.85"
                fontSize="10"
              >
                {formatBytes(r.node.size)}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  )
}
