import { useCallback, useMemo, useState } from 'react'
import type { FolderNode } from '@shared/types'
import { formatBytes } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6',
  '#6366f1', '#84cc16', '#f43f5e', '#0ea5e9', '#d946ef'
]

const MIN_RECT_SIZE = 3
const MAX_ITEMS = 40

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
  hasChildren: boolean
}

// Squarified treemap layout — produces more visually balanced rectangles
function squarify(
  children: { node: FolderNode; ratio: number }[],
  x: number, y: number, w: number, h: number,
  colorOffset: number
): Rect[] {
  if (children.length === 0 || w < MIN_RECT_SIZE || h < MIN_RECT_SIZE) return []

  const rects: Rect[] = []
  let remaining = [...children]
  let cx = x, cy = y, cw = w, ch = h

  while (remaining.length > 0) {
    const isHorizontal = cw >= ch
    const side = isHorizontal ? ch : cw
    const row: typeof remaining = []
    let rowSum = 0
    let worstRatio = Infinity

    for (const item of remaining) {
      const testSum = rowSum + item.ratio
      const testRow = [...row, item]
      const worst = worstAspectRatio(testRow, testSum, side)

      if (worst <= worstRatio || row.length === 0) {
        row.push(item)
        rowSum = testSum
        worstRatio = worst
      } else {
        break
      }
    }

    remaining = remaining.slice(row.length)

    // Layout the row
    const rowPixels = rowSum > 0 ? (isHorizontal ? cw : ch) * (rowSum / (rowSum + remaining.reduce((s, r) => s + r.ratio, 0))) : 0

    let rx = cx, ry = cy
    for (const item of row) {
      const fraction = rowSum > 0 ? item.ratio / rowSum : 0
      const rw = isHorizontal ? rowPixels : cw * fraction
      const rh = isHorizontal ? ch * fraction : rowPixels
      const dirChildren = item.node.children.filter((c) => !c.isFile && c.size > 0)

      rects.push({
        x: rx, y: ry, w: rw, h: rh,
        node: item.node,
        color: COLORS[(rects.length + colorOffset) % COLORS.length],
        hasChildren: dirChildren.length > 0,
      })

      if (isHorizontal) ry += rh
      else rx += rw
    }

    if (isHorizontal) { cx += rowPixels; cw -= rowPixels }
    else { cy += rowPixels; ch -= rowPixels }
  }

  return rects
}

function worstAspectRatio(row: { ratio: number }[], sum: number, side: number): number {
  if (sum === 0 || side === 0) return Infinity
  let worst = 0
  for (const item of row) {
    const area = (item.ratio / sum) * sum * side
    const rw = area / side
    const rh = side
    const ratio = Math.max(rw / rh, rh / rw)
    if (ratio > worst) worst = ratio
  }
  return worst
}

export function TreemapChart({ data, width, height }: TreemapChartProps) {
  const { tk, t } = useI18n()
  const [path, setPath] = useState<FolderNode[]>([])
  const [hovered, setHovered] = useState<Rect | null>(null)

  const currentNode = path.length > 0 ? path[path.length - 1] : data

  const rects = useMemo(() => {
    const children = currentNode.children
      .filter((c) => c.size > 0)
      .sort((a, b) => b.size - a.size)
      .slice(0, MAX_ITEMS)

    const total = children.reduce((acc, c) => acc + c.size, 0)
    if (total === 0) return []

    const items = children.map((node) => ({ node, ratio: node.size / total }))
    return squarify(items, 0, 0, width, height, 0)
  }, [currentNode, width, height])

  const handleClick = useCallback((rect: Rect) => {
    if (rect.hasChildren) {
      setPath((prev) => [...prev, rect.node])
      setHovered(null)
    }
  }, [])

  const navigateTo = useCallback((index: number) => {
    if (index < 0) {
      setPath([])
    } else {
      setPath((prev) => prev.slice(0, index + 1))
    }
    setHovered(null)
  }, [])

  if (rects.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px' }}>
        {tk('common.no_data')}
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, fontSize: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigateTo(-1)}
          style={{
            ...breadcrumbStyle,
            fontWeight: path.length === 0 ? 700 : 400,
            color: path.length === 0 ? 'var(--text-primary)' : 'var(--accent-blue)',
          }}
        >
          {data.name || t('Root')}
        </button>
        {path.map((node, i) => (
          <span key={node.path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <button
              onClick={() => navigateTo(i)}
              style={{
                ...breadcrumbStyle,
                fontWeight: i === path.length - 1 ? 700 : 400,
                color: i === path.length - 1 ? 'var(--text-primary)' : 'var(--accent-blue)',
              }}
            >
              {node.name}
            </button>
          </span>
        ))}
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        <svg width={width} height={height} style={{ borderRadius: 'var(--radius)', display: 'block' }}>
          {rects.map((r) => {
            const isHovered = hovered?.node.path === r.node.path
            return (
              <g
                key={r.node.path ?? r.node.name}
                onMouseEnter={() => setHovered(r)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleClick(r)}
                style={{ cursor: r.hasChildren ? 'pointer' : 'default' }}
              >
                <rect
                  x={r.x + 1} y={r.y + 1}
                  width={Math.max(r.w - 2, 0)} height={Math.max(r.h - 2, 0)}
                  fill={r.color}
                  opacity={isHovered ? 1 : 0.8}
                  rx={4}
                  stroke={isHovered ? 'var(--text-primary)' : 'none'}
                  strokeWidth={isHovered ? 1.5 : 0}
                />
                {r.w > 50 && r.h > 28 && (
                  <text x={r.x + 6} y={r.y + 16} fill="var(--text-on-accent)" fontSize="11" fontWeight="600" pointerEvents="none">
                    {truncate(r.node.name, Math.floor(r.w / 7))}
                  </text>
                )}
                {r.w > 50 && r.h > 42 && (
                  <text x={r.x + 6} y={r.y + 30} fill="var(--text-on-accent)" fillOpacity="0.85" fontSize="10" pointerEvents="none">
                    {formatBytes(r.node.size)}
                  </text>
                )}
                {r.hasChildren && r.w > 50 && r.h > 56 && (
                  <text x={r.x + 6} y={r.y + 43} fill="var(--text-on-accent)" fillOpacity="0.6" fontSize="9" pointerEvents="none">
                    {r.node.children.filter((c) => !c.isFile).length} {t('folders')}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            padding: '8px 12px', borderRadius: 8,
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontSize: 12, maxWidth: 250, pointerEvents: 'none', zIndex: 10,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, wordBreak: 'break-all' }}>{hovered.node.name}</div>
            <div style={{ color: 'var(--text-secondary)' }}>{formatBytes(hovered.node.size)}</div>
            {!hovered.node.isFile && (
              <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
                {hovered.node.children.filter((c) => !c.isFile).length} {t('folders')}, {hovered.node.children.filter((c) => c.isFile).length} {t('files')}
              </div>
            )}
            {hovered.hasChildren && (
              <div style={{ color: 'var(--accent-blue)', marginTop: 4, fontSize: 11 }}>
                {t('Click to drill down')}
              </div>
            )}
            {currentNode !== data && (
              <div style={{ color: 'var(--text-tertiary)', marginTop: 2, fontSize: 11 }}>
                {((hovered.node.size / currentNode.size) * 100).toFixed(1)}% {t('of current view')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

const breadcrumbStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: '2px 4px',
  cursor: 'pointer', fontSize: 12, borderRadius: 4,
}
