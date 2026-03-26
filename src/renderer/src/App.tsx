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
import type { ShutdownState } from '@shared/types'
import { isSystemStats, isAlertArray, isShutdownState, isUpdateInfo, isUpdateStatus, isProcessSnapshot } from '@shared/types'
import { PROCESS_UPDATE_INTERVAL_MS } from '@shared/constants/intervals'
import { useState } from 'react'
import { useI18n } from './i18n/useI18n'
import { useUpdateStore } from './stores/useUpdateStore'
import { useToast } from './components/Toast'
import { applySettingsToStore, loadAppSettings } from './utils/settingsBootstrap'
import { reportRendererError } from './utils/rendererLogging'
import { translateKey, translateLiteral } from '@shared/i18n'

const PROCESS_POLLING_START_DELAY_MS = 2_500

function App() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const hasUnsavedSettings = useSettingsStore((s) => s.hasUnsavedSettings)
  const theme = useSettingsStore((s) => s.theme)
  const setCpuProcesses = useProcessStore((s) => s.setCpuProcesses)
  const setMemoryProcesses = useProcessStore((s) => s.setMemoryProcesses)
  const setAllProcesses = useProcessStore((s) => s.setAllProcesses)
  const pushStats = useSystemStore((s) => s.pushStats)
  const addAlerts = useAlertStore((s) => s.addAlerts)
  const setAlerts = useAlertStore((s) => s.setAlerts)
  const applyUpdateStatus = useUpdateStore((s) => s.applyStatus)
  const setUpdateInfo = useUpdateStore((s) => s.setUpdateInfo)
  const showToast = useToast((s) => s.show)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [shutdownState, setShutdownState] = useState<ShutdownState | null>(null)
  const [processPollingReady, setProcessPollingReady] = useState(false)
  const { tk } = useI18n()
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const isE2ELightweight = window.__E2E_LIGHTWEIGHT === true

  // Keyboard shortcuts: Cmd/Ctrl + 1-6 for page navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      if (e.shiftKey || e.altKey) return
      const pages = ['dashboard', 'disk', 'docker', 'process', 'apps', 'settings'] as const
      const idx = parseInt(e.key, 10) - 1
      if (idx >= 0 && idx < pages.length) {
        e.preventDefault()
        if (currentPage === 'settings' && hasUnsavedSettings) return
        setCurrentPage(pages[idx])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, hasUnsavedSettings, setCurrentPage])

  useEffect(() => {
    if (isE2ELightweight) {
      setBootstrapped(true)
      return
    }

    void loadAppSettings('app-bootstrap').then((settings) => {
      if (settings) {
        applySettingsToStore(settings)
      }
    }).catch((error) => {
      void reportRendererError('app-bootstrap', 'Failed to bootstrap app', { error })
      showToast(
        translateKey(useSettingsStore.getState().locale, 'app.error_boundary.message'),
        'danger'
      )
    }).finally(() => {
      setBootstrapped(true)
    })

    void window.systemScope.getActiveAlerts().then((alertsRes) => {
      if (alertsRes.ok && alertsRes.data && isAlertArray(alertsRes.data)) {
        setAlerts(alertsRes.data)
      } else if (!alertsRes.ok) {
        void reportRendererError('app-bootstrap', 'Failed to load active alerts', {
          error: alertsRes.error
        })
      }
    }).catch((error) => {
      void reportRendererError('app-bootstrap', 'Failed to load active alerts', { error })
    })

    void window.systemScope.getUpdateStatus().then((updateRes) => {
      if (updateRes.ok && updateRes.data && isUpdateStatus(updateRes.data)) {
        applyUpdateStatus(updateRes.data)
      } else if (!updateRes.ok) {
        void reportRendererError('app-bootstrap', 'Failed to load update status', {
          error: updateRes.error
        })
      }
    }).catch((error) => {
      void reportRendererError('app-bootstrap', 'Failed to load update status', { error })
    })
  }, [applyUpdateStatus, isE2ELightweight, setAlerts, showToast])

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
    const locale = useSettingsStore.getState().locale
    const titles: Record<string, string> = {
      dashboard: translateLiteral(locale, "Overview"),
      disk: translateLiteral(locale, "Storage"),
      docker: translateLiteral(locale, "Docker"),
      process: translateLiteral(locale, "Activity"),
      apps: translateLiteral(locale, "Applications"),
      settings: translateLiteral(locale, "Preferences"),
    }
    document.title = `SystemScope — ${titles[currentPage] ?? "SystemScope"}`
  }, [currentPage])

  useEffect(() => {
    if (isE2ELightweight) {
      return
    }

    window.systemScope.subscribeSystem()

    return () => {
      window.systemScope.unsubscribeSystem()
    }
  }, [isE2ELightweight])

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
  const shouldPollProcessesBase = !isE2ELightweight && (currentPage === 'dashboard' || currentPage === 'process')

  useEffect(() => {
    if (!shouldPollProcessesBase) {
      setProcessPollingReady(false)
      return
    }

    const timer = window.setTimeout(() => {
      setProcessPollingReady(true)
    }, PROCESS_POLLING_START_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [shouldPollProcessesBase])

  const shouldPollProcesses = shouldPollProcessesBase && processPollingReady

  useInterval(() => {
    void window.systemScope.getProcessSnapshot(10).then((res) => {
      if (res.ok && res.data && isProcessSnapshot(res.data)) {
        setAllProcesses(res.data.allProcesses)
        setCpuProcesses(res.data.topCpuProcesses)
        setMemoryProcesses(res.data.topMemoryProcesses)
      }
    }).catch((error) => {
      void reportRendererError('process-polling', 'Failed to refresh process lists', { error })
    })
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
