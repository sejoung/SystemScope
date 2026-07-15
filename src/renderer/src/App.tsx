import { Suspense, useCallback, useEffect } from 'react'
import { Layout } from './components/layout/Layout'
import { ToastContainer } from './components/ui/Toast'
import { PageLoading } from './components/ui/PageLoading'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { ShutdownOverlay } from './components/layout/ShutdownOverlay'
import { useSettingsStore } from './stores/settings/useSettingsStore'
import { useProcessStore } from './stores/process/useProcessStore'
import { useSystemStore } from './stores/system/useSystemStore'
import { useAlertStore } from './stores/alerts/useAlertStore'
import { useInterval } from './hooks/useInterval'
import { useIpcListener } from './hooks/useIpc'
import { AppsPage, CleanupPage, DashboardPage, DevToolsPage, DiskAnalysisPage, DockerPage, ProcessPage, SettingsPage, TimelinePage } from './pages/lazyPages'
import type { ShutdownState } from '@shared/types'
import { isSystemStats, isAlertArray, isShutdownState, isUpdateInfo, isUpdateStatus, isProcessSnapshot } from '@shared/types'
import { PROCESS_UPDATE_INTERVAL_MS } from '@shared/constants/intervals'
import { useState } from 'react'
import { useI18n } from './i18n/useI18n'
import { useUpdateStore } from './stores/update/useUpdateStore'
import { useToast } from './components/ui/Toast'
import { applySettingsToStore, loadAppSettings } from './utils/settingsBootstrap'
import { reportRendererError } from './utils/rendererLogging'
import { translate } from '@shared/i18n'

const PROCESS_POLLING_START_DELAY_MS = 2_500

function App() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const hasUnsavedSettings = useSettingsStore((s) => s.hasUnsavedSettings)
  const theme = useSettingsStore((s) => s.theme)
  const locale = useSettingsStore((s) => s.locale)
  const setProcessSnapshot = useProcessStore((s) => s.setProcessSnapshot)
  const pushStats = useSystemStore((s) => s.pushStats)
  const addAlerts = useAlertStore((s) => s.addAlerts)
  const setAlerts = useAlertStore((s) => s.setAlerts)
  const applyUpdateStatus = useUpdateStore((s) => s.applyStatus)
  const setUpdateInfo = useUpdateStore((s) => s.setUpdateInfo)
  const showToast = useToast((s) => s.show)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [shutdownState, setShutdownState] = useState<ShutdownState | null>(null)
  const [processPollingReady, setProcessPollingReady] = useState(false)
  const [documentVisible, setDocumentVisible] = useState(true)
  const { tk } = useI18n()
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const isE2ELightweight = window.__E2E_LIGHTWEIGHT === true

  // Keyboard shortcuts: Cmd/Ctrl + 1-9 for page navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      if (e.shiftKey || e.altKey) return
      const pages = ['dashboard', 'timeline', 'disk', 'docker', 'cleanup', 'process', 'devtools', 'apps', 'settings'] as const
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
        translate(useSettingsStore.getState().locale, 'app.error_boundary.message'),
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
    const titles: Record<string, string> = {
      dashboard: translate(locale, "Overview"),
      timeline: translate(locale, "Timeline"),
      disk: translate(locale, "Storage"),
      docker: translate(locale, "Docker & Containers"),
      cleanup: translate(locale, "Cleanup"),
      process: translate(locale, "Activity"),
      devtools: translate(locale, "DevTools"),
      apps: translate(locale, "Applications"),
      settings: translate(locale, "Preferences"),
    }
    document.title = `SystemScope — ${titles[currentPage] ?? "SystemScope"}`
  }, [currentPage, locale])

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

  useEffect(() => {
    const handleVisibility = () => setDocumentVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // 프로세스 데이터 폴링 — 대시보드 또는 프로세스 페이지에서만 갱신
  const shouldPollProcessesBase = !isE2ELightweight && documentVisible && (currentPage === 'dashboard' || currentPage === 'process')

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
        setProcessSnapshot(res.data.allProcesses, res.data.topCpuProcesses, res.data.topMemoryProcesses)
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
          <Suspense fallback={<PageLoading />}>
            {currentPage === 'dashboard' && <DashboardPage />}
            {currentPage === 'timeline' && <TimelinePage />}
            {currentPage === 'disk' && <DiskAnalysisPage />}
            {currentPage === 'docker' && <DockerPage />}
            {currentPage === 'cleanup' && <CleanupPage />}
            {currentPage === 'process' && <ProcessPage />}
            {currentPage === 'devtools' && <DevToolsPage />}
            {currentPage === 'apps' && <AppsPage />}
            {currentPage === 'settings' && <SettingsPage />}
          </Suspense>
        </ErrorBoundary>
      </Layout>
      {shutdownState && <ShutdownOverlay state={shutdownState} title={tk('app.shutdown.title')} />}
      <ToastContainer />
    </>
  )
}

export default App
