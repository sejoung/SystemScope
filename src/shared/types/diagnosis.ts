export type DiagnosisSeverity = 'info' | 'warning' | 'critical'

export type DiagnosisCategory =
  | 'memory_pressure'
  | 'cpu_runaway'
  | 'disk_bottleneck'
  | 'disk_space_low'
  | 'docker_reclaimable'
  | 'cache_bloat'
  | 'swap_usage'
  | 'network_saturation'

export interface DiagnosisResult {
  id: string
  category: DiagnosisCategory
  severity: DiagnosisSeverity
  title: string
  description: string
  evidence: DiagnosisEvidence[]
  actions: DiagnosisAction[]
  detectedAt: number  // Unix timestamp
}

export interface DiagnosisEvidence {
  label: string
  value: string
  threshold?: string
}

export interface DiagnosisAction {
  label: string
  targetPage?: string  // page to navigate to
  actionId?: string    // optional action identifier for automation
}

export interface DiagnosisSummary {
  results: DiagnosisResult[]
  analyzedAt: number
}

/** Extended alert with intelligence features */
export interface AlertHistoryEntry {
  id: string
  type: string
  severity: 'warning' | 'critical'
  message: string
  firedAt: number
  resolvedAt?: number
  durationMs?: number
}

export interface AlertPattern {
  type: string
  count: number
  period: string  // e.g., "24h"
  lastOccurred: number
}

export interface AlertIntelligence {
  activeAlerts: AlertHistoryEntry[]
  patterns: AlertPattern[]
  sustainedAlerts: AlertHistoryEntry[]  // alerts lasting > 5 min
}
