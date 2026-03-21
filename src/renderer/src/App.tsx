import { Layout } from './components/Layout'
import { useSettingsStore } from './stores/useSettingsStore'
import { DashboardPage } from './pages/DashboardPage'
import { DiskAnalysisPage } from './pages/DiskAnalysisPage'
import { ProcessPage } from './pages/ProcessPage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  const currentPage = useSettingsStore((s) => s.currentPage)

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
