import { useCallback, useEffect } from 'react'
import { Layout } from './components/Layout'
import { useSettingsStore } from './stores/useSettingsStore'
import { useProcessStore } from './stores/useProcessStore'
import { useSystemStore } from './stores/useSystemStore'
import { useAlertStore } from './stores/useAlertStore'
import { useInterval } from './hooks/useInterval'
import { useIpcListener } from './hooks/useIpc'
import { DashboardPage } from './pages/DashboardPage'
import { DiskAnalysisPage } from './pages/DiskAnalysisPage'
import { ProcessPage } from './pages/ProcessPage'
import { SettingsPage } from './pages/SettingsPage'
import type { AlertThresholds, Alert, SystemStats } from '@shared/types'
import { PROCESS_UPDATE_INTERVAL_MS } from '@shared/constants/intervals'

function App() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setThresholds = useSettingsStore((s) => s.setThresholds)
  const setCpuProcesses = useProcessStore((s) => s.setCpuProcesses)
  const setMemoryProcesses = useProcessStore((s) => s.setMemoryProcesses)
  const setAllProcesses = useProcessStore((s) => s.setAllProcesses)
  const pushStats = useSystemStore((s) => s.pushStats)
  const setSubscribed = useSystemStore((s) => s.setSubscribed)
  const addAlerts = useAlertStore((s) => s.addAlerts)

  useEffect(() => {
    window.systemScope.getSettings().then((res) => {
      if (res.ok && res.data) {
        const settings = res.data as { theme?: 'dark' | 'light'; thresholds?: AlertThresholds }
        if (settings.theme) setTheme(settings.theme)
        if (settings.thresholds) setThresholds(settings.thresholds)
      }
    })
  }, [setTheme, setThresholds])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    window.systemScope.subscribeSystem()
    setSubscribed(true)

    return () => {
      window.systemScope.unsubscribeSystem()
      setSubscribed(false)
    }
  }, [setSubscribed])

  const handleSystemUpdate = useCallback(
    (data: unknown) => {
      pushStats(data as SystemStats)
    },
    [pushStats]
  )
  useIpcListener(window.systemScope.onSystemUpdate, handleSystemUpdate)

  const handleAlertFired = useCallback(
    (data: unknown) => {
      addAlerts(data as Alert[])
    },
    [addAlerts]
  )
  useIpcListener(window.systemScope.onAlertFired, handleAlertFired)

  // 프로세스 데이터 글로벌 폴링 — 어떤 페이지에 있든 갱신
  useInterval(() => {
    Promise.all([
      window.systemScope.getAllProcesses(),
      window.systemScope.getTopCpuProcesses(10),
      window.systemScope.getTopMemoryProcesses(10)
    ]).then(([allRes, cpuRes, memRes]) => {
      if (allRes.ok && allRes.data) setAllProcesses(allRes.data)
      if (cpuRes.ok && cpuRes.data) setCpuProcesses(cpuRes.data)
      if (memRes.ok && memRes.data) setMemoryProcesses(memRes.data)
    })
  }, PROCESS_UPDATE_INTERVAL_MS)

  return (
    <Layout>
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'disk' && <DiskAnalysisPage />}
      {currentPage === 'process' && <ProcessPage />}
      {currentPage === 'settings' && <SettingsPage />}
    </Layout>
  )
}

export default App
