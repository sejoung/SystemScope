import { useSettingsStore } from '../stores/useSettingsStore'
import { CpuWidget } from '../features/monitoring/CpuWidget'
import { MemoryWidget } from '../features/monitoring/MemoryWidget'
import { GpuWidget } from '../features/monitoring/GpuWidget'
import { RealtimeChart } from '../features/monitoring/RealtimeChart'
import { YourStorage } from '../features/disk/YourStorage'
import { GrowthView } from '../features/disk/GrowthView'
import { TopResourceConsumers } from '../features/process/TopResourceConsumers'
import { AlertBanner } from '../features/alerts/AlertBanner'

export function DashboardPage() {
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

      {/* Bottom row 2: Top Resource Consumers */}
      <div>
        <TopResourceConsumers />
      </div>
    </div>
  )
}
