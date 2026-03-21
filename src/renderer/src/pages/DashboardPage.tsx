import { useEffect, useCallback } from 'react'
import { useSystemStore } from '../stores/useSystemStore'
import { useProcessStore } from '../stores/useProcessStore'
import { useAlertStore } from '../stores/useAlertStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useIpcListener } from '../hooks/useIpc'
import { useInterval } from '../hooks/useInterval'
import { CpuWidget } from '../features/monitoring/CpuWidget'
import { MemoryWidget } from '../features/monitoring/MemoryWidget'
import { GpuWidget } from '../features/monitoring/GpuWidget'
import { RealtimeChart } from '../features/monitoring/RealtimeChart'
import { YourStorage } from '../features/disk/YourStorage'
import { TopProcesses } from '../features/process/TopProcesses'
import { AlertBanner } from '../features/alerts/AlertBanner'
import type { SystemStats, Alert } from '@shared/types'
import { PROCESS_UPDATE_INTERVAL_MS } from '@shared/constants/intervals'

export function DashboardPage() {
  const pushStats = useSystemStore((s) => s.pushStats)
  const setSubscribed = useSystemStore((s) => s.setSubscribed)
  const cpuProcesses = useProcessStore((s) => s.cpuProcesses)
  const memoryProcesses = useProcessStore((s) => s.memoryProcesses)
  const setCpuProcesses = useProcessStore((s) => s.setCpuProcesses)
  const setMemoryProcesses = useProcessStore((s) => s.setMemoryProcesses)
  const addAlerts = useAlertStore((s) => s.addAlerts)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  // Subscribe to realtime system updates
  useEffect(() => {
    window.systemScope.subscribeSystem()
    setSubscribed(true)
    return () => {
      window.systemScope.unsubscribeSystem()
      setSubscribed(false)
    }
  }, [setSubscribed])

  // Listen for system update events
  const handleSystemUpdate = useCallback(
    (data: unknown) => {
      pushStats(data as SystemStats)
    },
    [pushStats]
  )
  useIpcListener(window.systemScope.onSystemUpdate, handleSystemUpdate)

  // Listen for alert events
  const handleAlertFired = useCallback(
    (data: unknown) => {
      addAlerts(data as Alert[])
    },
    [addAlerts]
  )
  useIpcListener(window.systemScope.onAlertFired, handleAlertFired)

  // Poll process data
  useInterval(() => {
    window.systemScope.getTopCpuProcesses(10).then((res) => {
      if (res.ok && res.data) setCpuProcesses(res.data)
    })
    window.systemScope.getTopMemoryProcesses(10).then((res) => {
      if (res.ok && res.data) setMemoryProcesses(res.data)
    })
  }, PROCESS_UPDATE_INTERVAL_MS)

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

      {/* Bottom: Disk + Process */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <YourStorage onFolderClick={() => setCurrentPage('disk')} />
        <TopProcesses processes={cpuProcesses} title="Top CPU Processes" metric="cpu" />
        <TopProcesses processes={memoryProcesses} title="Top Memory Processes" metric="memory" />
      </div>
    </div>
  )
}
