import { randomUUID } from 'node:crypto'
import type { WorkspaceProfile, AlertThresholds, CleanupRuleConfig } from '@shared/types'
import { MAX_PROFILES, PROFILE_NAME_MAX_LENGTH, DASHBOARD_WIDGET_KEYS } from '@shared/types'
import { getSettings, setSettings } from '../store/settingsStore'
import { setThresholds } from './alertManager'
import { logInfo } from './logging'

export function getProfiles(): WorkspaceProfile[] {
  return getSettings().profiles
}

export function getActiveProfileId(): string | null {
  return getSettings().activeProfileId
}

export function getActiveProfile(): WorkspaceProfile | null {
  const settings = getSettings()
  if (!settings.activeProfileId) return null
  return settings.profiles.find((p) => p.id === settings.activeProfileId) ?? null
}

export function saveProfile(profile: WorkspaceProfile): WorkspaceProfile {
  const settings = getSettings()
  const profiles = [...settings.profiles]

  if (!profile.name || profile.name.length > PROFILE_NAME_MAX_LENGTH) {
    throw new Error(`Profile name must be 1-${PROFILE_NAME_MAX_LENGTH} characters`)
  }

  const validKeys = new Set<string>(DASHBOARD_WIDGET_KEYS)
  for (const key of profile.hiddenWidgets) {
    if (!validKeys.has(key)) {
      throw new Error(`Invalid widget key: ${key}`)
    }
  }

  const existingIndex = profiles.findIndex((p) => p.id === profile.id)
  let savedProfile: WorkspaceProfile

  if (existingIndex >= 0) {
    profiles[existingIndex] = profile
    savedProfile = profile
    logInfo('profile-manager', `Profile updated: ${profile.name} (${profile.id})`)
  } else {
    if (profiles.length >= MAX_PROFILES) {
      throw new Error(`Maximum of ${MAX_PROFILES} profiles allowed`)
    }
    savedProfile = { ...profile, id: profile.id || randomUUID() }
    profiles.push(savedProfile)
    logInfo('profile-manager', `Profile created: ${savedProfile.name} (${savedProfile.id})`)
  }

  setSettings({ profiles })

  if (settings.activeProfileId === savedProfile.id) {
    applyProfileSideEffects(savedProfile)
  }

  return savedProfile
}

export function deleteProfile(id: string): boolean {
  const settings = getSettings()
  const profiles = settings.profiles.filter((p) => p.id !== id)

  if (profiles.length === settings.profiles.length) {
    return false
  }

  setSettings({ profiles })

  if (settings.activeProfileId === id) {
    setSettings({ activeProfileId: null })
    setThresholds(getSettings().thresholds)
    logInfo('profile-manager', 'Active profile deleted, reverted to global thresholds')
  }

  logInfo('profile-manager', `Profile deleted: ${id}`)
  return true
}

export function setActiveProfile(id: string | null): WorkspaceProfile | null {
  const settings = getSettings()

  if (id === null) {
    setSettings({ activeProfileId: null })
    setThresholds(settings.thresholds)
    logInfo('profile-manager', 'Profile deactivated, reverted to global thresholds')
    return null
  }

  const profile = settings.profiles.find((p) => p.id === id)
  if (!profile) {
    throw new Error(`Profile not found: ${id}`)
  }

  setSettings({ activeProfileId: id })
  applyProfileSideEffects(profile)
  logInfo('profile-manager', `Profile activated: ${profile.name} (${profile.id})`)
  return profile
}

export function getEffectiveThresholds(): AlertThresholds {
  const profile = getActiveProfile()
  return profile ? profile.thresholds : getSettings().thresholds
}

export function getEffectiveCleanupRules(): CleanupRuleConfig[] {
  const profile = getActiveProfile()
  return profile ? profile.cleanupRules : getSettings().automation.rules
}

function applyProfileSideEffects(profile: WorkspaceProfile): void {
  setThresholds(profile.thresholds)
  logInfo('profile-manager', `Applied profile thresholds: ${profile.name}`)
}
