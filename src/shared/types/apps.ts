export type InstalledAppPlatform = 'mac' | 'windows'
export type InstalledAppUninstallKind = 'trash_app' | 'uninstall_command' | 'open_settings'

export interface InstalledApp {
  id: string
  name: string
  version?: string
  publisher?: string
  installLocation?: string
  launchPath?: string
  uninstallCommand?: string
  quietUninstallCommand?: string
  platform: InstalledAppPlatform
  uninstallKind: InstalledAppUninstallKind
  protected: boolean
  protectedReason?: string
}

export interface AppRemovalResult {
  id: string
  name: string
  started: boolean
  completed: boolean
  cancelled: boolean
  message?: string
}
