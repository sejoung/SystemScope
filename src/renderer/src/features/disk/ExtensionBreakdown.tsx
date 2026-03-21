import type { ExtensionGroup } from '@shared/types'
import { Card } from '../../components/Card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6'
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface ExtensionBreakdownProps {
  data: ExtensionGroup[]
}

export function ExtensionBreakdown({ data }: ExtensionBreakdownProps) {
  const top10 = data.slice(0, 10).map((d) => ({
    ...d,
    sizeGB: d.totalSize / (1024 * 1024 * 1024)
  }))

  return (
    <Card title="Extensions">
      {top10.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>데이터가 없습니다</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={top10} layout="vertical" margin={{ left: 60 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(val) => formatBytes(val * 1024 * 1024 * 1024)}
            />
            <YAxis
              type="category"
              dataKey="extension"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              width={55}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
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
    </Card>
  )
}
