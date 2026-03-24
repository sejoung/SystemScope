import { useSettingsStore } from '../stores/useSettingsStore'
import { useSystemStore } from '../stores/useSystemStore'
import { CpuWidget } from '../features/monitoring/CpuWidget'
import { MemoryWidget } from '../features/monitoring/MemoryWidget'
import { GpuWidget } from '../features/monitoring/GpuWidget'
import { RealtimeChart } from '../features/monitoring/RealtimeChart'
import { YourStorage } from '../features/disk/YourStorage'
import { GrowthView } from '../features/disk/GrowthView'
import { TopResourceConsumers } from '../features/process/TopResourceConsumers'
import { AlertBanner } from '../features/alerts/AlertBanner'
import { PageLoading } from '../components/PageLoading'

export function DashboardPage() {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const current = useSystemStore((s) => s.current)

  if (!current) return <PageLoading />

  return (
    <div>
      <AlertBanner />

      {/* Top: Gauges */}
      <div className="dashboard-grid-3">
        <CpuWidget />
        <MemoryWidget />
        <GpuWidget />
      </div>

      {/* Middle: Realtime chart */}
      <div className="dashboard-section">
        <RealtimeChart />
      </div>

      {/* Bottom row 1: Storage + Growth */}
      <div className="dashboard-grid-responsive">
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
