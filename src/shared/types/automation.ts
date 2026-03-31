export type CleanupRuleId =
  | 'downloads_old_files'
  | 'xcode_derived_data'
  | 'xcode_archives'
  | 'npm_cache'
  | 'pnpm_cache'
  | 'yarn_cache'
  | 'docker_stopped_containers'
  | 'old_logs'
  | 'temp_files'

export interface CleanupRule {
  id: CleanupRuleId
  name: string
  description: string
  category: 'downloads' | 'dev_tools' | 'package_managers' | 'docker' | 'system'
  enabled: boolean
  /** Minimum age in days for files to be eligible */
  minAgeDays: number
  /** Paths this rule scans (resolved at runtime) */
  targetPaths: string[]
}

export interface CleanupPreviewItem {
  path: string
  size: number
  modifiedAt: number
  rule: CleanupRuleId
}

export interface CleanupPreview {
  items: CleanupPreviewItem[]
  totalSize: number
  ruleBreakdown: {
    ruleId: CleanupRuleId
    ruleName: string
    itemCount: number
    totalSize: number
  }[]
  scannedAt: number
}

export interface CleanupResult {
  deletedCount: number
  deletedSize: number
  failedCount: number
  failedPaths: string[]
  completedAt: number
}

export interface CleanupInboxItem {
  id: string
  ruleId: CleanupRuleId
  ruleName: string
  category: string
  path: string
  size: number
  modifiedAt: number
  safetyLevel: 'safe' | 'caution' | 'risky'
  reason: string
}

export interface CleanupInbox {
  items: CleanupInboxItem[]
  totalReclaimable: number
  generatedAt: number
}

export interface CleanupRuleConfig {
  id: CleanupRuleId
  enabled: boolean
  minAgeDays: number
}

export interface AutomationSchedule {
  enabled: boolean
  /** Cron-like interval: 'daily' | 'weekly' | 'manual' */
  frequency: 'daily' | 'weekly' | 'manual'
  /** Last execution timestamp */
  lastRunAt?: number
}
