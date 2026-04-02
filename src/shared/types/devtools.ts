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

export interface AIUsageWindow {
  label: string
  kind: 'limit' | 'usage'
  usedPercent: number | null
  value: number | null
  valueLabel: string | null
  resetsAt: number | null
}

export interface AIUsageModelUsage {
  model: string
  tokens: number
}

export interface AIUsageDetectedProvider {
  id: string
  tool: 'codex' | 'claude'
  label: string
  installed: boolean
  sourcePath: string | null
  detectedAt: number
  lastUpdatedAt: number | null
  planType: string | null
  totalTokens: number | null
  inputTokens: number | null
  outputTokens: number | null
  contextWindow: number | null
  monthlyTokens: number | null
  windows: AIUsageWindow[]
  modelUsage: AIUsageModelUsage[]
}

export interface AIUsageOverview {
  providers: AIUsageDetectedProvider[]
  scannedAt: number
}
