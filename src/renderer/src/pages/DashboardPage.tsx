import { useSettingsStore } from '../stores/useSettingsStore'
import { useProcessStore } from '../stores/useProcessStore'
import { CpuWidget } from '../features/monitoring/CpuWidget'
import { MemoryWidget } from '../features/monitoring/MemoryWidget'
import { GpuWidget } from '../features/monitoring/GpuWidget'
import { RealtimeChart } from '../features/monitoring/RealtimeChart'
import { YourStorage } from '../features/disk/YourStorage'
import { GrowthView } from '../features/disk/GrowthView'
import { TopProcesses } from '../features/process/TopProcesses'
import { AlertBanner } from '../features/alerts/AlertBanner'

export function DashboardPage() {
  const cpuProcesses = useProcessStore((s) => s.cpuProcesses)
  const memoryProcesses = useProcessStore((s) => s.memoryProcesses)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  return (
    <div>
      <AlertBanner />

      {/* Top: Gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <CpuWidget />
        <MemoryWidget />
        <GpuWidget />
      </div>

      {/* Middle: Realtime chart */}
      <div style={{ marginBottom: '16px' }}>
        <RealtimeChart />
      </div>

      {/* Bottom row 1: Storage + Growth */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <YourStorage onFolderClick={() => setCurrentPage('disk')} />
        <GrowthView />
      </div>

      {/* Bottom row 2: Process */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <TopProcesses processes={cpuProcesses} title="CPU Hotspots" metric="cpu" />
        <TopProcesses processes={memoryProcesses} title="Memory Hotspots" metric="memory" />
      </div>
    </div>
  )
}
