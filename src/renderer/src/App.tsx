import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { useSettingsStore } from './stores/useSettingsStore'
import { DashboardPage } from './pages/DashboardPage'
import { DiskAnalysisPage } from './pages/DiskAnalysisPage'
import { ProcessPage } from './pages/ProcessPage'
import { SettingsPage } from './pages/SettingsPage'
import type { AlertThresholds } from '@shared/types'

function App() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setThresholds = useSettingsStore((s) => s.setThresholds)

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
