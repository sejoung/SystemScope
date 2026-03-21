import type { ExtensionGroup } from '@shared/types'
import { Accordion } from '../../components/Accordion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatBytes } from '../../utils/format'

const COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6'
]

interface ExtensionBreakdownProps {
  data: ExtensionGroup[]
}

export function ExtensionBreakdown({ data }: ExtensionBreakdownProps) {
  const top10 = data.slice(0, 10).map((d) => ({
    ...d,
    sizeGB: d.totalSize / (1024 * 1024 * 1024)
  }))

  return (
    <Accordion title="File Types" defaultOpen>
      {top10.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>데이터가 없습니다</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={top10} layout="vertical" margin={{ left: 60 }}>
            <XAxis
              type="number"
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={{ stroke: 'var(--chart-grid)' }}
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              tickFormatter={(val) => formatBytes(val * 1024 * 1024 * 1024)}
            />
            <YAxis
              type="category"
              dataKey="extension"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              width={55}
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
              formatter={(val: number) => formatBytes(val * 1024 * 1024 * 1024)}
            />
            <Bar dataKey="sizeGB" radius={[0, 4, 4, 0]}>
              {top10.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Accordion>
  )
}
