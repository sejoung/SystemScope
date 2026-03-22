import { useCallback, useEffect } from 'react'
import { Layout } from './components/Layout'
import { ToastContainer } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSettingsStore } from './stores/useSettingsStore'
import { useProcessStore } from './stores/useProcessStore'
import { useSystemStore } from './stores/useSystemStore'
import { useAlertStore } from './stores/useAlertStore'
import { useInterval } from './hooks/useInterval'
import { useIpcListener } from './hooks/useIpc'
import { DashboardPage } from './pages/DashboardPage'
import { DiskAnalysisPage } from './pages/DiskAnalysisPage'
import { DockerPage } from './pages/DockerPage'
import { ProcessPage } from './pages/ProcessPage'
import { SettingsPage } from './pages/SettingsPage'
import type { AlertThresholds, Alert, SystemStats } from '@shared/types'
import { PROCESS_UPDATE_INTERVAL_MS } from '@shared/constants/intervals'

function App() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const hasUnsavedSettings = useSettingsStore((s) => s.hasUnsavedSettings)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setThresholds = useSettingsStore((s) => s.setThresholds)
  const setCpuProcesses = useProcessStore((s) => s.setCpuProcesses)
  const setMemoryProcesses = useProcessStore((s) => s.setMemoryProcesses)
  const setAllProcesses = useProcessStore((s) => s.setAllProcesses)
  const pushStats = useSystemStore((s) => s.pushStats)
  const addAlerts = useAlertStore((s) => s.addAlerts)
  const setAlerts = useAlertStore((s) => s.setAlerts)

  useEffect(() => {
    void Promise.all([
      window.systemScope.getSettings(),
      window.systemScope.getActiveAlerts()
    ]).then(([settingsRes, alertsRes]) => {
      if (settingsRes.ok && settingsRes.data) {
        const settings = settingsRes.data as { theme?: 'dark' | 'light'; thresholds?: AlertThresholds }
        if (settings.theme) setTheme(settings.theme)
        if (settings.thresholds) setThresholds(settings.thresholds)
      }

      if (alertsRes.ok && alertsRes.data) {
        setAlerts(alertsRes.data as Alert[])
      }
    })
  }, [setAlerts, setTheme, setThresholds])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    void window.systemScope.setUnsavedSettingsState(hasUnsavedSettings)
  }, [hasUnsavedSettings])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedSettings) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedSettings])

  useEffect(() => {
    window.systemScope.subscribeSystem()

    return () => {
      window.systemScope.unsubscribeSystem()
    }
  }, [])

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
    void Promise.all([
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
    <>
      <Layout>
        <ErrorBoundary
          title="Page Render Failed"
          message="현재 페이지를 렌더링하지 못했습니다. 다른 메뉴로 이동한 뒤 다시 시도해주세요."
          resetKey={currentPage}
        >
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'disk' && <DiskAnalysisPage />}
          {currentPage === 'docker' && <DockerPage />}
          {currentPage === 'process' && <ProcessPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </ErrorBoundary>
      </Layout>
      <ToastContainer />
    </>
  )
}

export default App
