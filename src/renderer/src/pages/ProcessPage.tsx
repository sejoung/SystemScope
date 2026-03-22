import { useProcessStore } from '../stores/useProcessStore'
import { ProcessTable } from '../features/process/ProcessTable'
import { PortFinder } from '../features/process/PortFinder'

export function ProcessPage() {
  const allProcesses = useProcessStore((s) => s.allProcesses)

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Process Activity</h2>
      <div style={{ marginBottom: '16px' }}>
        <ProcessTable processes={allProcesses} />
      </div>
      <PortFinder />
    </div>
  )
}
