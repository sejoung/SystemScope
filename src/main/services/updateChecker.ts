import { app, BrowserWindow, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import type { UpdateInfo, UpdateStatus } from '@shared/types'
import { logError, logInfoAction, logWarn } from './logging'

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const RELEASES_API_URL = 'https://api.github.com/repos/sejoung/SystemScope/releases/latest'
const DOWNLOAD_PAGE_URL = 'https://sejoung.github.io/SystemScope/'

type FetchLike = typeof fetch
type GitHubReleaseResponse = {
  tag_name?: unknown
  html_url?: unknown
  body?: unknown
  published_at?: unknown
}

let updateCheckTimer: NodeJS.Timeout | null = null
let startupCheckTimer: NodeJS.Timeout | null = null
let lastBroadcastVersion: string | null = null
let currentStatus: UpdateStatus = {
  currentVersion: getCurrentVersion(),
  checking: false,
  updateInfo: null,
  lastCheckedAt: null
}

export function startUpdateChecker(options: { initialDelayMs?: number } = {}): void {
  if (!isPackagedApp()) {
    return
  }

  const initialDelayMs = Math.max(options.initialDelayMs ?? 0, 0)

  if (startupCheckTimer) {
    clearTimeout(startupCheckTimer)
    startupCheckTimer = null
  }

  if (initialDelayMs === 0) {
    void checkForUpdates({ source: 'startup' })
  } else {
    startupCheckTimer = setTimeout(() => {
      startupCheckTimer = null
      void checkForUpdates({ source: 'startup' })
    }, initialDelayMs)
    startupCheckTimer.unref?.()
  }

  if (updateCheckTimer) {
    clearInterval(updateCheckTimer)
  }

  updateCheckTimer = setInterval(() => {
    void checkForUpdates({ source: 'interval' })
  }, UPDATE_CHECK_INTERVAL_MS)
  updateCheckTimer.unref?.()
}

export function stopUpdateChecker(): void {
  if (startupCheckTimer) {
    clearTimeout(startupCheckTimer)
    startupCheckTimer = null
  }
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer)
    updateCheckTimer = null
  }
}

export function getUpdateStatus(): UpdateStatus {
  return {
    ...currentStatus,
    updateInfo: currentStatus.updateInfo ? { ...currentStatus.updateInfo } : null
  }
}

export async function checkForUpdates(
  options: { source: 'startup' | 'interval' | 'manual'; fetchImpl?: FetchLike } = { source: 'manual' }
): Promise<UpdateStatus> {
  currentStatus = {
    ...currentStatus,
    currentVersion: getCurrentVersion(),
    checking: true
  }

  try {
    const release = await fetchLatestRelease(currentStatus.currentVersion, options.fetchImpl)
    currentStatus = {
      currentVersion: getCurrentVersion(),
      checking: false,
      updateInfo: release ?? currentStatus.updateInfo,
      lastCheckedAt: new Date().toISOString()
    }

    if (release?.hasUpdate) {
      maybeBroadcastUpdate(release, options.source)
    }
  } catch (error) {
    currentStatus = {
      ...currentStatus,
      currentVersion: getCurrentVersion(),
      checking: false,
      lastCheckedAt: new Date().toISOString()
    }
    logError('update-checker', 'Unexpected update check failure', error)
  }

  return getUpdateStatus()
}

export async function openReleasePage(rawUrl: string): Promise<boolean> {
  const validated = validateReleaseUrl(rawUrl)
  if (!validated) {
    return false
  }

  await shell.openExternal(validated)
  return true
}

export async function fetchLatestRelease(currentVersion: string, fetchImpl: FetchLike = fetch): Promise<UpdateInfo | null> {
  try {
    const response = await fetchImpl(RELEASES_API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SystemScope'
      }
    })

    if (!response.ok) {
      logWarn('update-checker', 'Update check request failed', { status: response.status })
      return null
    }

    const payload = (await response.json()) as GitHubReleaseResponse
    return parseLatestRelease(payload, currentVersion)
  } catch (error) {
    logWarn('update-checker', 'Update check skipped due to network failure', error)
    return null
  }
}

export function parseLatestRelease(payload: GitHubReleaseResponse, currentVersion: string): UpdateInfo | null {
  const latestVersion = normalizeVersion(payload.tag_name)
  const releaseUrl = validateReleaseUrl(DOWNLOAD_PAGE_URL)
  const publishedAt = typeof payload.published_at === 'string' ? payload.published_at : null

  if (!latestVersion || !releaseUrl || !publishedAt) {
    return null
  }

  const comparison = compareVersions(latestVersion, currentVersion)
  if (comparison === null) {
    return null
  }

  return {
    currentVersion: normalizeVersion(currentVersion) ?? currentVersion,
    latestVersion,
    hasUpdate: comparison > 0,
    releaseUrl,
    releaseNotes: typeof payload.body === 'string' ? payload.body.trim() : '',
    publishedAt
  }
}

export function compareVersions(left: string, right: string): number | null {
  const normalizedLeft = normalizeVersion(left)
  const normalizedRight = normalizeVersion(right)
  const leftParts = normalizedLeft ? parseSemver(normalizedLeft) : null
  const rightParts = normalizedRight ? parseSemver(normalizedRight) : null

  if (!leftParts || !rightParts) {
    return null
  }

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1
    if (leftParts[index] < rightParts[index]) return -1
  }

  return 0
}

export function normalizeVersion(version: unknown): string | null {
  if (typeof version !== 'string') {
    return null
  }

  const trimmed = version.trim().replace(/^v/i, '')
  return parseSemver(trimmed) ? trimmed : null
}

function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim())
  if (!match) {
    return null
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function validateReleaseUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') {
      return null
    }

    if (parsed.hostname !== 'sejoung.github.io') {
      return null
    }

    if (parsed.pathname !== '/SystemScope/' && parsed.pathname !== '/SystemScope') {
      return null
    }

    parsed.pathname = '/SystemScope/'
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function maybeBroadcastUpdate(updateInfo: UpdateInfo, source: 'startup' | 'interval' | 'manual'): void {
  if (lastBroadcastVersion === updateInfo.latestVersion) {
    return
  }

  lastBroadcastVersion = updateInfo.latestVersion
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed() && !win.webContents.isDestroyed())
  for (const win of windows) {
    win.webContents.send(IPC_CHANNELS.EVENT_UPDATE_AVAILABLE, updateInfo)
  }

  logInfoAction('update-checker', 'update.available', {
    latestVersion: updateInfo.latestVersion,
    currentVersion: updateInfo.currentVersion,
    source
  })
}

function getCurrentVersion(): string {
  return typeof app.getVersion === 'function' ? app.getVersion() : '0.0.0'
}

function isPackagedApp(): boolean {
  return typeof app.isPackaged === 'boolean' ? app.isPackaged : false
}
