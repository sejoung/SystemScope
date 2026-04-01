export type ToolName = 'homebrew' | 'xcode'
export type ToolStatus = 'ready' | 'not_installed' | 'error'
export type SafetyLevel = 'safe' | 'caution' | 'risky'

export interface ToolSummaryItem {
  key: string
  label: string
  value: string
}

export interface ReclaimableItem {
  id: string
  tool: ToolName
  path: string
  label: string
  size: number
  category: string
  safetyLevel: SafetyLevel
}

export interface ToolIntegrationResult {
  tool: ToolName
  status: ToolStatus
  message: string | null
  summary: ToolSummaryItem[]
  reclaimable: ReclaimableItem[]
  lastScannedAt: number
}

export interface ToolCleanResult {
  succeeded: string[]
  failed: string[]
}
