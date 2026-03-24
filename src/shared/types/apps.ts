export type InstalledAppPlatform = 'mac' | 'windows'
export type InstalledAppUninstallKind = 'trash_app' | 'uninstall_command' | 'open_settings'
export type AppLeftoverConfidence = 'high' | 'medium' | 'low'

export interface InstalledApp {
  id: string
  name: string
  version?: string
  publisher?: string
  bundleId?: string
  installLocation?: string
  launchPath?: string
  uninstallCommand?: string
  quietUninstallCommand?: string
  platform: InstalledAppPlatform
  uninstallKind: InstalledAppUninstallKind
  protected: boolean
  protectedReason?: string
}

export interface AppRelatedDataItem {
  id: string
  label: string
  path: string
  source: string
}

export interface AppLeftoverDataItem extends AppRelatedDataItem {
  appName: string
  platform: InstalledAppPlatform
  confidence: AppLeftoverConfidence
  reason: string
  risk: string
}

export interface AppUninstallRequest {
  appId: string
  relatedDataIds?: string[]
}

export interface AppRemovalResult {
  id: string
  name: string
  started: boolean
  completed: boolean
  cancelled: boolean
  action?: 'trash' | 'uninstaller' | 'open_settings'
  message?: string
  relatedDataDeletedCount?: number
  relatedDataFailedPaths?: string[]
}
