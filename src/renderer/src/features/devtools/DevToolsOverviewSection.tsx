import { useEffect, useMemo, useState } from 'react'
import { formatBytes } from '@shared/utils/formatBytes'
import { useI18n } from '../../i18n/useI18n'
import { useDevToolsOverviewStore } from '../../stores/useDevToolsOverviewStore'
import { useProfileStore } from '../../stores/useProfileStore'
import { useProjectMonitorStore } from '../../stores/useProjectMonitorStore'
import { usePortFinderStore } from '../../stores/usePortFinderStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useToast } from '../../components/Toast'
import { MAX_WORKSPACE_PATHS } from '@shared/types'

type DevToolsOverviewPanel = 'health' | 'docker' | 'workspaces' | 'servers'

interface DevToolsOverviewSectionProps {
  sections?: DevToolsOverviewPanel[]
  compact?: boolean
}

export function DevToolsOverviewSection({
  sections = ['health', 'docker', 'workspaces', 'servers'],
  compact = false,
}: DevToolsOverviewSectionProps) {
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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={overviewToolbarStyle}>
        <OverviewRefreshButton
          loading={loading}
          label={tk(loading ? 'Refreshing...' : 'Refresh All')}
          onClick={() => void handleRefreshOverview()}
        />
      </div>

      {sections.includes('health') ? (
        <section style={cardStyle}>
          <SectionHeader
            title={tk('Environment Health')}
            description={tk('Check whether local developer tools are installed and ready before you start a session.')}
          />
          {error ? <div style={errorStyle}>{error}</div> : null}
          <div style={gridStyle}>
            {(compact ? (overview?.healthChecks ?? []).slice(0, 6) : (overview?.healthChecks ?? [])).map((check) => (
              <div key={check.id} style={tileStyle}>
                <div style={tileHeaderStyle}>
                  <span style={tileTitleStyle}>{check.label}</span>
                  <span style={{ ...statusPillStyle, ...getStatusStyle(check.status) }}>
                    {tk(check.status === 'healthy' ? 'Ready' : check.status === 'warning' ? 'Needs Review' : 'Missing')}
                  </span>
                </div>
                <div style={detailStyle}>{check.version ?? check.detail}</div>
                {check.hint ? <div style={hintStyle}>{check.hint}</div> : null}
              </div>
            ))}
            {!loading && (overview?.healthChecks.length ?? 0) === 0 ? (
              <div style={emptyStyle}>{tk('No environment checks are available right now.')}</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {sections.includes('docker') ? (
        <section style={cardStyle}>
          <div style={sectionHeaderRowStyle}>
            <SectionHeader
              title={tk('Docker Runtime')}
              description={tk('Review whether Docker is available and how much container cleanup work is waiting before opening the full Docker workspace.')}
            />
            <DockerOpenButton label={tk('Open Docker')} onClick={() => handleOpenDocker()} />
          </div>
          {overview?.docker ? (
            <div style={rowCardStyle}>
              <div style={workspaceHeaderStyle}>
                <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
                  <div style={tileHeaderStyle}>
                    <span style={tileTitleStyle}>{tk('Docker & Containers')}</span>
                    <span style={{ ...statusPillStyle, ...getStatusStyle(overview.docker.status) }}>
                      {tk(
                        overview.docker.status === 'healthy'
                          ? 'Ready'
                          : overview.docker.status === 'warning'
                            ? 'Needs Review'
                            : 'Missing',
                      )}
                    </span>
                  </div>
                  <div style={detailStyle}>{overview.docker.detail}</div>
                  {overview.docker.hint ? <div style={hintStyle}>{overview.docker.hint}</div> : null}
                </div>
                <div style={workspaceMetaColumnStyle}>
                  <div style={workspaceMetaWrapStyle}>
                    <MetaPill label={tk('Running Containers')} value={String(overview.docker.runningContainers)} />
                    <MetaPill label={tk('Stopped')} value={String(overview.docker.stoppedContainers)} />
                    <MetaPill label={tk('Unused Images')} value={String(overview.docker.unusedImages)} />
                    <MetaPill label={tk('Unused Volumes')} value={String(overview.docker.unusedVolumes)} />
                    <MetaPill label={tk('Build Cache')} value={overview.docker.reclaimableBuildCacheLabel} />
                  </div>
                  <DockerQuickActions
                    labels={{
                      containers: tk('Containers'),
                      images: tk('Docker Images'),
                      volumes: tk('Volumes'),
                      buildCache: tk('Build Cache'),
                    }}
                    onOpenContainers={() => handleOpenDocker('containers')}
                    onOpenImages={() => handleOpenDocker('images')}
                    onOpenVolumes={() => handleOpenDocker('volumes')}
                    onOpenBuildCache={() => handleOpenDocker('build-cache')}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div style={emptyStyle}>{tk('Docker summary is not available right now.')}</div>
          )}
        </section>
      ) : null}

      {sections.includes('workspaces') ? (
        <section style={cardStyle}>
          <div style={sectionHeaderRowStyle}>
            <SectionHeader
              title={tk('Workspace Environment')}
              description={tk('Review stack signals, environment files, build artifacts, Git state, and active dev servers across tracked workspaces.')}
            />
            {!compact ? (
              <div style={workspaceToolbarStyle}>
                <select
                  value={selectedWorkspacePath}
                  onChange={(event) => setSelectedWorkspacePath(event.target.value)}
                  style={selectStyle}
                >
                  <option value="all">{tk('All Workspaces')}</option>
                  {(overview?.workspaces ?? []).map((workspace) => (
                    <option key={workspace.path} value={workspace.path}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => void handleAddWorkspace()} style={actionButtonStyle}>
                  {tk('Add Workspace')}
                </button>
              </div>
            ) : null}
          </div>
          {!compact && !activeProfile ? (
            <div style={emptyStyle}>
              {tk('Activate a workspace profile to manage tracked workspaces from DevTools.')}
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 10 }}>
            {visibleWorkspaces.map((workspace) => (
              <div key={workspace.path} style={rowCardStyle}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={workspaceHeaderStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={tileTitleStyle}>{workspace.name}</div>
                      <div style={pathStyle}>{workspace.path}</div>
                    </div>
                    <div style={workspaceMetaColumnStyle}>
                      <div style={workspaceMetaWrapStyle}>
                        <MetaPill label={tk('Branch')} value={workspace.branch ?? tk('No repo')} />
                        <MetaPill label={tk('Dependency Tooling')} value={workspace.packageManager ?? '-'} />
                        <MetaPill label={tk('Stacks')} value={workspace.stacks.join(', ') || '-'} />
                        <MetaPill label={tk('Manifests')} value={String(workspace.manifestCount)} />
                        <MetaPill label={tk('Env File')} value={workspace.hasEnvFile ? tk('Yes') : tk('No')} />
                        <MetaPill label={tk('TypeScript Config')} value={workspace.hasTypeScriptConfig ? tk('Yes') : tk('No')} />
                        <MetaPill label={tk('Docker Config')} value={workspace.hasDockerConfig ? tk('Yes') : tk('No')} />
                        <MetaPill label={tk('Active Servers')} value={String(workspace.activeDevServerCount)} />
                        <MetaPill label={tk('Dirty')} value={String(workspace.dirtyFileCount)} />
                        <MetaPill label={tk('Untracked')} value={String(workspace.untrackedFileCount)} />
                        <MetaPill label={tk('Stash')} value={String(workspace.stashCount)} />
                      </div>
                      {!compact && activeProfile ? (
                        <button
                          type="button"
                          onClick={() => void handleRemoveWorkspace(workspace.path)}
                          style={removeButtonStyle}
                        >
                          {tk('Remove')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {workspace.lastCommitAt ? (
                    <div style={hintStyle}>
                      {tk('Last commit')}: {new Date(workspace.lastCommitAt).toLocaleString()}
                    </div>
                  ) : null}
                  {workspace.artifactDirectories.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={subsectionLabelStyle}>{tk('Build Artifacts')}</div>
                      <div style={workspaceMetaWrapStyle}>
                        {workspace.artifactDirectories.map((artifact) => (
                          <MetaPill key={`${workspace.path}-${artifact}`} label={tk('Artifact')} value={artifact} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {workspace.activeDevServerPorts.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={subsectionLabelStyle}>{tk('Dev Server Ports')}</div>
                      <div style={workspaceMetaWrapStyle}>
                        {workspace.activeDevServerPorts.map((port) => (
                          <button
                            key={`${workspace.path}-${port}`}
                            type="button"
                            onClick={() => handleInspectPort(port)}
                            style={secondaryActionButtonStyle}
                          >
                            {port}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {workspace.largeUntrackedFiles.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={subsectionLabelStyle}>{tk('Large Untracked Files')}</div>
                      {workspace.largeUntrackedFiles.map((file) => (
                        <div key={file.path} style={listRowStyle}>
                          <span style={pathStyle}>{file.path}</span>
                          <span style={detailStyle}>{formatBytes(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {!loading && (overview?.workspaces.length ?? 0) === 0 ? (
            <div style={emptyStyle}>{tk('Add workspace paths to the active profile to see Git insights here.')}</div>
            ) : null}
            {!loading && (overview?.workspaces.length ?? 0) > 0 && visibleWorkspaces.length === 0 ? (
              <div style={emptyStyle}>{tk('No workspace matches the current selection.')}</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {sections.includes('servers') ? (
        <section style={cardStyle}>
          <SectionHeader
            title={tk('Runtime Services')}
            description={tk('Detect active local development servers, app runtimes, and data services from current listening ports.')}
          />
          <div style={{ display: 'grid', gap: 8 }}>
            {(compact ? (overview?.devServers ?? []).slice(0, 4) : (overview?.devServers ?? [])).map((server) => (
              <div key={`${server.pid}-${server.port}`} style={rowCardStyle}>
                <div style={workspaceHeaderStyle}>
                  <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                    <div style={tileTitleStyle}>
                      {server.kind} · {server.process}
                    </div>
                    <div style={hintStyle}>
                      {server.protocol.toUpperCase()} {server.address}:{server.port} · PID {server.pid}
                    </div>
                    {server.command ? <div style={pathStyle}>{server.command}</div> : null}
                    {server.workspaceMatchReason ? (
                      <div style={hintStyle}>{server.workspaceMatchReason}</div>
                    ) : null}
                  </div>
                  <div style={workspaceMetaColumnStyle}>
                    <div style={workspaceMetaWrapStyle}>
                      <MetaPill label={tk('Exposure')} value={server.exposure} />
                      <MetaPill label={tk('Workspace')} value={server.workspaceName ?? '-'} />
                    </div>
                    <div style={serverActionRowStyle}>
                      <button
                        type="button"
                        onClick={() => handleInspectPort(server.port)}
                        style={secondaryActionButtonStyle}
                      >
                        {tk('Inspect Port')}
                      </button>
                      {server.workspacePath ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (server.workspacePath) {
                              void handleOpenWorkspace(server.workspacePath)
                            }
                          }}
                          style={secondaryActionButtonStyle}
                        >
                          {tk('Open Workspace')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          {!loading && (overview?.devServers.length ?? 0) === 0 ? (
            <div style={emptyStyle}>{tk('No active development servers were detected from current listening ports.')}</div>
          ) : null}
        </div>
        </section>
      ) : null}
    </div>
  )
}

export function OverviewRefreshButton({
  loading,
  label,
  onClick,
}: {
  loading: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={loading} style={secondaryActionButtonStyle}>
      {label}
    </button>
  )
}

export function DockerOpenButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={secondaryActionButtonStyle}>
      {label}
    </button>
  )
}

export function DockerQuickActions({
  labels,
  onOpenContainers,
  onOpenImages,
  onOpenVolumes,
  onOpenBuildCache,
}: {
  labels: {
    containers: string
    images: string
    volumes: string
    buildCache: string
  }
  onOpenContainers: () => void
  onOpenImages: () => void
  onOpenVolumes: () => void
  onOpenBuildCache: () => void
}) {
  return (
    <div style={serverActionRowStyle}>
      <button type="button" onClick={onOpenContainers} style={secondaryActionButtonStyle}>
        {labels.containers}
      </button>
      <button type="button" onClick={onOpenImages} style={secondaryActionButtonStyle}>
        {labels.images}
      </button>
      <button type="button" onClick={onOpenVolumes} style={secondaryActionButtonStyle}>
        {labels.volumes}
      </button>
      <button type="button" onClick={onOpenBuildCache} style={secondaryActionButtonStyle}>
        {labels.buildCache}
      </button>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={sectionDescriptionStyle}>{description}</div>
    </div>
  )
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span style={metaPillStyle}>
      {label}: <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
    </span>
  )
}

function getStatusStyle(status: 'healthy' | 'warning' | 'missing') {
  if (status === 'healthy') {
    return { color: 'var(--accent-green)', borderColor: 'color-mix(in srgb, var(--accent-green) 35%, transparent)' }
  }
  if (status === 'warning') {
    return { color: 'var(--accent-yellow)', borderColor: 'color-mix(in srgb, var(--accent-yellow) 35%, transparent)' }
  }
  return { color: 'var(--accent-red)', borderColor: 'color-mix(in srgb, var(--accent-red) 35%, transparent)' }
}

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 10,
}

const tileHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const tileStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
}

const rowCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-primary)',
}

const sectionDescriptionStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
}

const tileTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-primary)',
}

const detailStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  lineHeight: 1.5,
}

const pathStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono, monospace)',
  wordBreak: 'break-word',
}

const statusPillStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid transparent',
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const metaPillStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 999,
  fontSize: 11,
  color: 'var(--text-secondary)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: 12,
  minWidth: 180,
  maxWidth: '100%',
  flex: '1 1 220px',
}

const actionButtonStyle: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
}

const removeButtonStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--accent-red)',
  fontSize: 11,
  cursor: 'pointer',
}

const subsectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
}

const listRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--accent-red)',
}

const emptyStyle: React.CSSProperties = {
  padding: '8px 0',
  fontSize: 12,
  color: 'var(--text-muted)',
}

const sectionHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const workspaceToolbarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
  width: '100%',
  maxWidth: 420,
}

const workspaceHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const workspaceMetaColumnStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  justifyItems: 'end',
  maxWidth: '100%',
}

const workspaceMetaWrapStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  maxWidth: '100%',
}

const serverActionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}

const overviewToolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
}

const secondaryActionButtonStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: 11,
  cursor: 'pointer',
}
