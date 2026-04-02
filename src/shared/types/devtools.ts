export type DevEnvironmentStatus = 'healthy' | 'warning' | 'missing'

export interface DevEnvironmentCheck {
  id: string
  label: string
  status: DevEnvironmentStatus
  detail: string
  version: string | null
  hint: string | null
}

export interface DevWorkspaceLargeFile {
  path: string
  size: number
}

export interface DevWorkspaceInsight {
  path: string
  name: string
  exists: boolean
  isGitRepo: boolean
  branch: string | null
  packageManager: string | null
  dirtyFileCount: number
  untrackedFileCount: number
  stashCount: number
  lastCommitAt: number | null
  largeUntrackedFiles: DevWorkspaceLargeFile[]
}

export interface DevServerEntry {
  pid: number
  process: string
  command: string | null
  kind: string
  port: number
  protocol: string
  address: string
  exposure: 'loopback' | 'network' | 'unknown'
  workspacePath: string | null
  workspaceName: string | null
  workspaceMatchReason: string | null
}

export interface DevToolsOverview {
  healthChecks: DevEnvironmentCheck[]
  workspaces: DevWorkspaceInsight[]
  devServers: DevServerEntry[]
  scannedAt: number
}

