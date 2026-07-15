import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../i18n/useI18n'
import { useDevToolsOverviewStore } from '../../../stores/devtools/useDevToolsOverviewStore'
import { useProfileStore } from '../../../stores/profile/useProfileStore'
import { useProjectMonitorStore } from '../../../stores/projectMonitor/useProjectMonitorStore'
import { usePortFinderStore } from '../../../stores/process/usePortFinderStore'
import { useSettingsStore } from '../../../stores/settings/useSettingsStore'
import { useToast } from '../../../components/ui/Toast'
import { MAX_WORKSPACE_PATHS } from '@shared/types'

export function useDevToolsOverviewSectionModel(compact: boolean) {
  const { tk } = useI18n()
  const showToast = useToast((s) => s.show)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const setDockerTab = useSettingsStore((s) => s.setDockerTab)
  const overview = useDevToolsOverviewStore((s) => s.overview)
  const loading = useDevToolsOverviewStore((s) => s.loading)
  const error = useDevToolsOverviewStore((s) => s.error)
  const fetchOverview = useDevToolsOverviewStore((s) => s.fetchOverview)
  const profiles = useProfileStore((s) => s.profiles)
  const activeProfileId = useProfileStore((s) => s.activeProfileId)
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles)
  const saveProfile = useProfileStore((s) => s.saveProfile)
  const fetchProjectMonitorSummary = useProjectMonitorStore((s) => s.fetchSummary)
  const setPortSearch = usePortFinderStore((s) => s.setSearch)
  const setPortSearchScope = usePortFinderStore((s) => s.setSearchScope)
  const setPortStateFilter = usePortFinderStore((s) => s.setStateFilter)
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string>('all')

  const activeProfile = useMemo(
    () => (activeProfileId ? profiles.find((profile) => profile.id === activeProfileId) ?? null : null),
    [activeProfileId, profiles],
  )

  useEffect(() => {
    if (!overview && !loading) {
      void fetchOverview()
    }
  }, [fetchOverview, loading, overview])

  useEffect(() => {
    if (profiles.length === 0 && activeProfileId === null) {
      void fetchProfiles()
    }
  }, [activeProfileId, fetchProfiles, profiles.length])

  useEffect(() => {
    if (
      selectedWorkspacePath !== 'all' &&
      !(overview?.workspaces ?? []).some((workspace) => workspace.path === selectedWorkspacePath)
    ) {
      setSelectedWorkspacePath('all')
    }
  }, [overview?.workspaces, selectedWorkspacePath])

  const visibleWorkspaces = useMemo(() => {
    const workspaces = overview?.workspaces ?? []
    if (selectedWorkspacePath === 'all') {
      return compact ? workspaces.slice(0, 3) : workspaces
    }
    return workspaces.filter((workspace) => workspace.path === selectedWorkspacePath)
  }, [compact, overview?.workspaces, selectedWorkspacePath])

  async function handleAddWorkspace() {
    if (!activeProfile) {
      showToast(tk('Activate a workspace profile before adding tracked folders.'), 'default')
      return
    }
    if (activeProfile.workspacePaths.length >= MAX_WORKSPACE_PATHS) {
      showToast(tk('You have reached the maximum number of tracked workspaces for this profile.'), 'default')
      return
    }

    const res = await window.systemScope.selectFolder()
    if (!res.ok || typeof res.data !== 'string' || !res.data) {
      return
    }
    if (activeProfile.workspacePaths.includes(res.data)) {
      showToast(tk('This workspace is already being tracked.'), 'default')
      return
    }

    const saved = await saveProfile({
      ...activeProfile,
      workspacePaths: [...activeProfile.workspacePaths, res.data],
    })
    if (!saved) {
      showToast(tk('Unable to add the workspace to the active profile.'), 'danger')
      return
    }

    await Promise.all([
      fetchOverview(),
      fetchProjectMonitorSummary(),
    ])
    setSelectedWorkspacePath(res.data)
    showToast(tk('Workspace added.'), 'success')
  }

  async function handleRemoveWorkspace(workspacePath: string) {
    if (!activeProfile) {
      return
    }

    const saved = await saveProfile({
      ...activeProfile,
      workspacePaths: activeProfile.workspacePaths.filter((entry) => entry !== workspacePath),
    })
    if (!saved) {
      showToast(tk('Unable to remove the workspace from the active profile.'), 'danger')
      return
    }

    await Promise.all([
      fetchOverview(),
      fetchProjectMonitorSummary(),
    ])
    setSelectedWorkspacePath('all')
    showToast(tk('Workspace removed.'), 'success')
  }

  function handleInspectPort(port: number) {
    setPortSearch(String(port))
    setPortSearchScope('local')
    setPortStateFilter('LISTEN')
    setCurrentPage('process')
  }

  function handleOpenDocker(tab: 'overview' | 'containers' | 'images' | 'volumes' | 'build-cache' = 'overview') {
    setDockerTab(tab)
    setCurrentPage('docker')
  }

  async function handleRefreshOverview() {
    await fetchOverview({ forceRefresh: true })
  }

  async function handleOpenWorkspace(workspacePath: string) {
    const res = await window.systemScope.showInFolder(workspacePath)
    if (!res.ok) {
      showToast(res.error?.message ?? tk('Unable to open folder.'), 'danger')
    }
  }


  return { tk, overview, loading, error, activeProfile, selectedWorkspacePath, setSelectedWorkspacePath, visibleWorkspaces, handleAddWorkspace, handleRemoveWorkspace, handleInspectPort, handleOpenDocker, handleRefreshOverview, handleOpenWorkspace }
}
