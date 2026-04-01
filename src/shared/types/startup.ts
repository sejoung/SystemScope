export type StartupItemType = 'launch_agent' | 'launch_daemon' | 'login_item' | 'registry_run' | 'startup_folder'
export type StartupItemScope = 'user' | 'system'

export interface StartupItem {
  id: string
  name: string
  path: string
  type: StartupItemType
  scope: StartupItemScope
  enabled: boolean
  label: string | null
  description: string | null
}

export interface StartupToggleResult {
  id: string
  enabled: boolean
  success: boolean
  error: string | null
}
