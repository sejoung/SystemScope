export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseUrl: string
  releaseNotes: string
  publishedAt: string
}

export interface UpdateStatus {
  currentVersion: string
  checking: boolean
  updateInfo: UpdateInfo | null
  lastCheckedAt: string | null
}
