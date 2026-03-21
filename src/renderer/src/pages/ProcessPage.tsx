import { useCallback } from 'react'
import { useProcessStore } from '../stores/useProcessStore'
import { useInterval } from '../hooks/useInterval'
import { ProcessTable } from '../features/process/ProcessTable'
import { PROCESS_UPDATE_INTERVAL_MS } from '@shared/constants/intervals'

export function ProcessPage() {
  const cpuProcesses = useProcessStore((s) => s.cpuProcesses)
  const memoryProcesses = useProcessStore((s) => s.memoryProcesses)
  const setCpuProcesses = useProcessStore((s) => s.setCpuProcesses)
  const setMemoryProcesses = useProcessStore((s) => s.setMemoryProcesses)

  const fetchProcesses = useCallback(() => {
    window.systemScope.getTopCpuProcesses(20).then((res) => {
      if (res.ok && res.data) setCpuProcesses(res.data)
    })
    window.systemScope.getTopMemoryProcesses(20).then((res) => {
      if (res.ok && res.data) setMemoryProcesses(res.data)
    })
  }, [setCpuProcesses, setMemoryProcesses])

  useInterval(fetchProcesses, PROCESS_UPDATE_INTERVAL_MS)

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Processes</h2>
      <ProcessTable cpuProcesses={cpuProcesses} memoryProcesses={memoryProcesses} />
    </div>
  )
}
