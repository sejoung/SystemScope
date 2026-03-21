import { useState } from 'react'
import type { ProcessInfo } from '@shared/types'
import { Card } from '../../components/Card'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface ProcessTableProps {
  cpuProcesses: ProcessInfo[]
  memoryProcesses: ProcessInfo[]
}

export function ProcessTable({ cpuProcesses, memoryProcesses }: ProcessTableProps) {
  const [sortBy, setSortBy] = useState<'cpu' | 'memory'>('cpu')
  const processes = sortBy === 'cpu' ? cpuProcesses : memoryProcesses

  return (
    <Card title="Processes">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <TabButton active={sortBy === 'cpu'} onClick={() => setSortBy('cpu')}>
          CPU
        </TabButton>
        <TabButton active={sortBy === 'memory'} onClick={() => setSortBy('memory')}>
          Memory
        </TabButton>
      </div>

      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thStyle}>PID</th>
              <th style={thStyle}>Name</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>CPU %</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Memory</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <tr key={p.pid} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {p.pid}
                </td>
                <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {p.name}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                  <span style={{ color: p.cpu > 50 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                    {p.cpu.toFixed(1)}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatBytes(p.memoryBytes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: active ? 600 : 400,
        border: 'none',
        borderRadius: '6px',
        background: active ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
        color: active ? 'white' : 'var(--text-secondary)',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 4px',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

const tdStyle: React.CSSProperties = {
  padding: '6px 4px',
  color: 'var(--text-secondary)'
}
