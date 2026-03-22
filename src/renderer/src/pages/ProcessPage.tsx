import { useState } from 'react'
import { useProcessStore } from '../stores/useProcessStore'
import { ProcessTable } from '../features/process/ProcessTable'
import { PortFinder } from '../features/process/PortFinder'

type ActivityTab = 'processes' | 'ports'

export function ProcessPage() {
  const allProcesses = useProcessStore((s) => s.allProcesses)
  const [tab, setTab] = useState<ActivityTab>('processes')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Activity</h2>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px' }}>
          <PageTab active={tab === 'processes'} onClick={() => setTab('processes')}>
            Processes
          </PageTab>
          <PageTab active={tab === 'ports'} onClick={() => setTab('ports')}>
            Ports
          </PageTab>
        </div>
      </div>

      {tab === 'processes' && <ProcessTable processes={allProcesses} />}
      {tab === 'ports' && <PortFinder />}
    </div>
  )
}

function PageTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        border: 'none',
        borderRadius: '6px',
        background: active ? 'var(--accent-blue)' : 'transparent',
        color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}
