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
import { AppsPage } from './pages/AppsPage'
import { SettingsPage } from './pages/SettingsPage'
import type { AlertThresholds, Alert, ShutdownState, SystemStats, UpdateInfo, UpdateStatus } from '@shared/types'
import { PROCESS_UPDATE_INTERVAL_MS } from '@shared/constants/intervals'
import { useState } from 'react'
import { useI18n } from './i18n/useI18n'
import { useUpdateStore } from './stores/useUpdateStore'

function isSystemStats(data: unknown): data is SystemStats {
  return data !== null && typeof data === 'object' && 'cpu' in data && 'memory' in data && 'timestamp' in data
}

function isAlertArray(data: unknown): data is Alert[] {
  return Array.isArray(data) && data.every(item => typeof item === 'object' && item !== null && 'id' in item && 'type' in item)
}

function isShutdownState(data: unknown): data is ShutdownState {
  return data !== null && typeof data === 'object' && 'phase' in data && 'message' in data
}

function isUpdateInfo(data: unknown): data is UpdateInfo {
  return data !== null && typeof data === 'object' && 'latestVersion' in data && 'releaseUrl' in data
}

function isUpdateStatus(data: unknown): data is UpdateStatus {
  return data !== null && typeof data === 'object' && 'currentVersion' in data && 'checking' in data && 'lastCheckedAt' in data
}

function App() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const hasUnsavedSettings = useSettingsStore((s) => s.hasUnsavedSettings)
  const theme = useSettingsStore((s) => s.theme)
  const setLocale = useSettingsStore((s) => s.setLocale)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setThresholds = useSettingsStore((s) => s.setThresholds)
  const setCpuProcesses = useProcessStore((s) => s.setCpuProcesses)
  const setMemoryProcesses = useProcessStore((s) => s.setMemoryProcesses)
  const setAllProcesses = useProcessStore((s) => s.setAllProcesses)
  const pushStats = useSystemStore((s) => s.pushStats)
  const addAlerts = useAlertStore((s) => s.addAlerts)
  const setAlerts = useAlertStore((s) => s.setAlerts)
  const applyUpdateStatus = useUpdateStore((s) => s.applyStatus)
  const setUpdateInfo = useUpdateStore((s) => s.setUpdateInfo)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [shutdownState, setShutdownState] = useState<ShutdownState | null>(null)
  const { tk } = useI18n()

  useEffect(() => {
    void Promise.all([
      window.systemScope.getSettings(),
      window.systemScope.getActiveAlerts(),
      window.systemScope.getUpdateStatus()
    ]).then(([settingsRes, alertsRes, updateRes]) => {
      if (settingsRes.ok && settingsRes.data) {
        const settings = settingsRes.data as Record<string, unknown>
        if (settings.theme === 'dark' || settings.theme === 'light') setTheme(settings.theme)
        if (settings.locale === 'ko' || settings.locale === 'en') setLocale(settings.locale)
        if (settings.thresholds && typeof settings.thresholds === 'object') setThresholds(settings.thresholds as AlertThresholds)
      }

      if (alertsRes.ok && alertsRes.data && isAlertArray(alertsRes.data)) {
        setAlerts(alertsRes.data)
      }

      if (updateRes.ok && updateRes.data && isUpdateStatus(updateRes.data)) {
        applyUpdateStatus(updateRes.data)
      }
    }).catch(() => {
    }).finally(() => {
      setBootstrapped(true)
    })
  }, [applyUpdateStatus, setAlerts, setLocale, setTheme, setThresholds])

  useEffect(() => {
    document.body.dataset.e2eReady = bootstrapped ? '1' : '0'

    return () => {
      delete document.body.dataset.e2eReady
    }
  }, [bootstrapped])

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
      if (isSystemStats(data)) pushStats(data)
    },
    [pushStats]
  )
  useIpcListener(window.systemScope.onSystemUpdate, handleSystemUpdate)

  const handleAlertFired = useCallback(
    (data: unknown) => {
      if (isAlertArray(data)) addAlerts(data)
    },
    [addAlerts]
  )
  useIpcListener(window.systemScope.onAlertFired, handleAlertFired)

  const handleShutdownState = useCallback(
    (data: unknown) => {
      if (isShutdownState(data)) setShutdownState(data)
    },
    []
  )
  useIpcListener(window.systemScope.onShutdownState, handleShutdownState)

  const handleUpdateAvailable = useCallback(
    (data: unknown) => {
      if (isUpdateInfo(data)) {
        setUpdateInfo(data)
      }
    },
    [setUpdateInfo]
  )
  useIpcListener(window.systemScope.onUpdateAvailable, handleUpdateAvailable)

  // 프로세스 데이터 폴링 — 대시보드 또는 프로세스 페이지에서만 갱신
  const shouldPollProcesses = currentPage === 'dashboard' || currentPage === 'process'

  useInterval(() => {
    void Promise.all([
      window.systemScope.getAllProcesses(),
      window.systemScope.getTopCpuProcesses(10),
      window.systemScope.getTopMemoryProcesses(10)
    ]).then(([allRes, cpuRes, memRes]) => {
      if (allRes.ok && allRes.data) setAllProcesses(allRes.data)
      if (cpuRes.ok && cpuRes.data) setCpuProcesses(cpuRes.data)
      if (memRes.ok && memRes.data) setMemoryProcesses(memRes.data)
    }).catch(() => {})
  }, shouldPollProcesses ? PROCESS_UPDATE_INTERVAL_MS : null)

  return (
    <>
      <Layout>
        <ErrorBoundary
          title={tk('app.error_boundary.title')}
          message={tk('app.error_boundary.message')}
          resetKey={currentPage}
        >
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'disk' && <DiskAnalysisPage />}
          {currentPage === 'docker' && <DockerPage />}
          {currentPage === 'process' && <ProcessPage />}
          {currentPage === 'apps' && <AppsPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </ErrorBoundary>
      </Layout>
      {shutdownState && <ShutdownOverlay state={shutdownState} title={tk('app.shutdown.title')} />}
      <ToastContainer />
    </>
  )
}

export default App

function ShutdownOverlay({ state, title }: { state: ShutdownState; title: string }) {
  return (
    <div style={overlayStyle}>
      <div style={overlayCardStyle}>
        <div style={spinnerStyle} />
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{state.message}</div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(15, 23, 42, 0.46)',
  backdropFilter: 'blur(8px)',
  zIndex: 9999
}

const overlayCardStyle: React.CSSProperties = {
  minWidth: '280px',
  maxWidth: '420px',
  display: 'grid',
  gap: '10px',
  justifyItems: 'center',
  padding: '24px 28px',
  borderRadius: '16px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)'
}

const spinnerStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '999px',
  border: '3px solid color-mix(in srgb, var(--accent-blue) 22%, transparent)',
  borderTopColor: 'var(--accent-blue)',
  animation: 'systemscope-spin 0.9s linear infinite'
}
