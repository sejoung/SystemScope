import type { AlertThresholds } from './alert'
import type { CleanupRuleConfig, AutomationSchedule } from './automation'

export const DASHBOARD_WIDGET_KEYS = [
  'cpu',
  'memory',
  'gpu',
  'disk',
  'network',
  'realtimeChart',
  'storage',
  'growth',
  'topProcesses'
] as const

export type DashboardWidgetKey = typeof DASHBOARD_WIDGET_KEYS[number]

export const MAX_PROFILES = 10
export const PROFILE_NAME_MAX_LENGTH = 50
export const MAX_WORKSPACE_PATHS = 8

export interface WorkspaceProfile {
  id: string
  name: string
  icon: string
  thresholds: AlertThresholds
  cleanupRules: CleanupRuleConfig[]
  hiddenWidgets: DashboardWidgetKey[]
  workspacePaths: string[]
  automationSchedule: AutomationSchedule | null
}
