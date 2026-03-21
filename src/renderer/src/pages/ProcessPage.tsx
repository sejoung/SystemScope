import { useProcessStore } from '../stores/useProcessStore'
import { ProcessTable } from '../features/process/ProcessTable'

export function ProcessPage() {
  const allProcesses = useProcessStore((s) => s.allProcesses)
  const loading = useProcessStore((s) => s.allProcessesLoading)

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Process Activity</h2>
      <ProcessTable processes={allProcesses} loading={loading} />
    </div>
  )
}
