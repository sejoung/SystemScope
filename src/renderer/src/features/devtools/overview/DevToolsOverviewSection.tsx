import { cardStyle, tileHeaderStyle, rowCardStyle, tileTitleStyle, detailStyle, hintStyle, pathStyle, statusPillStyle, selectStyle, actionButtonStyle, removeButtonStyle, subsectionLabelStyle, listRowStyle, emptyStyle, sectionHeaderRowStyle, workspaceToolbarStyle, workspaceHeaderStyle, workspaceMetaColumnStyle, workspaceMetaWrapStyle, serverActionRowStyle, overviewToolbarStyle, secondaryActionButtonStyle } from './DevToolsOverviewSection.styles'
import { formatBytes } from '@shared/utils/formatBytes'
import { useDevToolsOverviewSectionModel } from './useDevToolsOverviewSectionModel'
import { DockerOpenButton, DockerQuickActions, MetaPill, OverviewRefreshButton, SectionHeader, getStatusStyle } from './DevToolsOverviewPrimitives'
import { DevToolsHealthPanel } from './DevToolsHealthPanel'
export { DockerOpenButton, DockerQuickActions, OverviewRefreshButton } from './DevToolsOverviewPrimitives'

type DevToolsOverviewPanel = 'health' | 'docker' | 'workspaces' | 'servers'

interface DevToolsOverviewSectionProps {
  sections?: DevToolsOverviewPanel[]
  compact?: boolean
}

export function DevToolsOverviewSection({ sections = ['health', 'docker', 'workspaces', 'servers'], compact = false }: DevToolsOverviewSectionProps) {
  const { tk, overview, loading, error, activeProfile, selectedWorkspacePath, setSelectedWorkspacePath, visibleWorkspaces, handleAddWorkspace, handleRemoveWorkspace, handleInspectPort, handleOpenDocker, handleRefreshOverview, handleOpenWorkspace } = useDevToolsOverviewSectionModel(compact)

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
        <DevToolsHealthPanel compact={compact} error={error} loading={loading} overview={overview} tk={tk} />
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
                  {workspace.pythonEnv ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={subsectionLabelStyle}>{tk('Python Environment')}</div>
                      <div style={workspaceMetaWrapStyle}>
                        <MetaPill label={tk('Env Type')} value={workspace.pythonEnv.envType} />
                        <MetaPill
                          label={tk('Python')}
                          value={workspace.pythonEnv.pythonVersion ?? '-'}
                        />
                        <MetaPill
                          label={tk('PyTorch')}
                          value={workspace.pythonEnv.torchVersion ?? tk('Not installed')}
                        />
                        {workspace.pythonEnv.torchVersion ? (
                          <MetaPill
                            label={tk('CUDA Available')}
                            value={
                              workspace.pythonEnv.torchCudaAvailable === null
                                ? tk('Unknown')
                                : workspace.pythonEnv.torchCudaAvailable
                                  ? tk('Yes')
                                  : tk('No')
                            }
                          />
                        ) : null}
                      </div>
                      <div style={pathStyle}>{workspace.pythonEnv.interpreterPath}</div>
                      {workspace.pythonEnv.detectionNote ? (
                        <div style={hintStyle}>{workspace.pythonEnv.detectionNote}</div>
                      ) : null}
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
