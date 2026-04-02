import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceProfile, AppSettings } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'
import { DEFAULT_SETTINGS } from '../../src/main/store/settingsSchema'

const mockGetSettings = vi.fn<() => AppSettings>()
const mockSetSettings = vi.fn()
const mockSetThresholds = vi.fn()
const mockLogInfo = vi.fn()
const mockRandomUUID = vi.fn(() => 'mock-uuid-1234')

vi.mock('node:crypto', () => ({
  randomUUID: () => mockRandomUUID()
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test' }
}))

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: () => mockGetSettings(),
  setSettings: (...args: unknown[]) => mockSetSettings(...args)
}))

vi.mock('../../src/main/services/alertManager', () => ({
  setThresholds: (...args: unknown[]) => mockSetThresholds(...args)
}))

vi.mock('../../src/main/services/logging', () => ({
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
  logWarn: (...args: unknown[]) => mockLogInfo(...args)
}))

import {
  getProfiles,
  getActiveProfile,
  saveProfile,
  deleteProfile,
  setActiveProfile,
  getEffectiveThresholds,
  getEffectiveCleanupRules
} from '../../src/main/services/profileManager'

function createTestProfile(overrides?: Partial<WorkspaceProfile>): WorkspaceProfile {
  return {
    id: 'profile-1',
    name: 'Development',
    icon: '\u{1F4BB}',
    thresholds: {
      cpuWarning: 70, cpuCritical: 85,
      diskWarning: 75, diskCritical: 90,
      memoryWarning: 70, memoryCritical: 85,
      gpuMemoryWarning: 75, gpuMemoryCritical: 90
    },
    cleanupRules: [{ id: 'npm_cache', enabled: true, minAgeDays: 14 }],
    hiddenWidgets: ['gpu'],
    ...overrides
  }
}

function createMockSettings(overrides?: Partial<AppSettings>): AppSettings {
  return { ...DEFAULT_SETTINGS, profiles: [], activeProfileId: null, ...overrides }
}

describe('profileManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockReturnValue(createMockSettings())
  })

  describe('getProfiles', () => {
    it('should return empty array when no profiles exist', () => {
      expect(getProfiles()).toEqual([])
    })

    it('should return all profiles from settings', () => {
      mockGetSettings.mockReturnValue(createMockSettings({ profiles: [createTestProfile()] }))
      expect(getProfiles()).toHaveLength(1)
    })
  })

  describe('getActiveProfile', () => {
    it('should return null when no active profile', () => {
      expect(getActiveProfile()).toBeNull()
    })

    it('should return the active profile', () => {
      mockGetSettings.mockReturnValue(createMockSettings({
        profiles: [createTestProfile()], activeProfileId: 'profile-1'
      }))
      expect(getActiveProfile()!.id).toBe('profile-1')
    })

    it('should return null if activeProfileId references missing profile', () => {
      mockGetSettings.mockReturnValue(createMockSettings({ activeProfileId: 'missing-id' }))
      expect(getActiveProfile()).toBeNull()
    })
  })

  describe('saveProfile', () => {
    it('should create a new profile', () => {
      mockRandomUUID.mockReturnValue('new-uuid')
      const saved = saveProfile(createTestProfile({ id: '' }))
      expect(saved.id).toBe('new-uuid')
      expect(mockSetSettings).toHaveBeenCalledWith({
        profiles: [expect.objectContaining({ id: 'new-uuid' })]
      })
    })

    it('should update an existing profile', () => {
      mockGetSettings.mockReturnValue(createMockSettings({ profiles: [createTestProfile()] }))
      const updated = saveProfile({ ...createTestProfile(), name: 'Updated' })
      expect(updated.name).toBe('Updated')
    })

    it('should throw when exceeding max profiles', () => {
      const profiles = Array.from({ length: 10 }, (_, i) =>
        createTestProfile({ id: `p-${i}`, name: `P${i}` })
      )
      mockGetSettings.mockReturnValue(createMockSettings({ profiles }))
      expect(() => saveProfile(createTestProfile({ id: '' }))).toThrow('Maximum of 10')
    })

    it('should throw when name is empty', () => {
      expect(() => saveProfile(createTestProfile({ name: '' }))).toThrow('Profile name must be')
    })

    it('should throw on invalid widget key', () => {
      expect(() => saveProfile(createTestProfile({
        hiddenWidgets: ['invalid' as never]
      }))).toThrow('Invalid widget key')
    })

    it('should throw on invalid thresholds', () => {
      expect(() => saveProfile(createTestProfile({
        thresholds: { cpuWarning: 70 } as WorkspaceProfile['thresholds']
      }))).toThrow('Invalid profile data')
    })

    it('should throw on invalid cleanup rules', () => {
      expect(() => saveProfile(createTestProfile({
        cleanupRules: [{ id: 'invalid' as never, enabled: true, minAgeDays: 14 }]
      }))).toThrow('Invalid profile data')
    })

    it('should apply side effects when updating the active profile', () => {
      const existing = createTestProfile()
      mockGetSettings.mockReturnValue(createMockSettings({
        profiles: [existing], activeProfileId: 'profile-1'
      }))
      const updatedThresholds = { ...existing.thresholds, cpuWarning: 60 }
      saveProfile({ ...existing, thresholds: updatedThresholds })
      expect(mockSetThresholds).toHaveBeenCalledWith(updatedThresholds)
    })
  })

  describe('deleteProfile', () => {
    it('should delete a profile', () => {
      mockGetSettings.mockReturnValue(createMockSettings({ profiles: [createTestProfile()] }))
      expect(deleteProfile('profile-1')).toBe(true)
      expect(mockSetSettings).toHaveBeenCalledWith({ profiles: [] })
    })

    it('should return false for non-existent profile', () => {
      expect(deleteProfile('nonexistent')).toBe(false)
    })

    it('should deactivate when deleting active profile', () => {
      mockGetSettings.mockReturnValue(createMockSettings({
        profiles: [createTestProfile()], activeProfileId: 'profile-1'
      }))
      deleteProfile('profile-1')
      expect(mockSetSettings).toHaveBeenCalledWith({ activeProfileId: null })
      expect(mockSetThresholds).toHaveBeenCalled()
    })
  })

  describe('setActiveProfile', () => {
    it('should activate a profile and apply thresholds', () => {
      const profile = createTestProfile()
      mockGetSettings.mockReturnValue(createMockSettings({ profiles: [profile] }))
      const activated = setActiveProfile('profile-1')
      expect(activated!.id).toBe('profile-1')
      expect(mockSetThresholds).toHaveBeenCalledWith(profile.thresholds)
    })

    it('should deactivate and revert to global thresholds', () => {
      const settings = createMockSettings({ profiles: [createTestProfile()], activeProfileId: 'profile-1' })
      mockGetSettings.mockReturnValue(settings)
      expect(setActiveProfile(null)).toBeNull()
      expect(mockSetThresholds).toHaveBeenCalledWith(settings.thresholds)
    })

    it('should throw when profile not found', () => {
      expect(() => setActiveProfile('nonexistent')).toThrow('Profile not found')
    })
  })

  describe('getEffectiveThresholds', () => {
    it('should return global thresholds when no active profile', () => {
      expect(getEffectiveThresholds()).toEqual(DEFAULT_THRESHOLDS)
    })

    it('should return profile thresholds when active', () => {
      mockGetSettings.mockReturnValue(createMockSettings({
        profiles: [createTestProfile()], activeProfileId: 'profile-1'
      }))
      expect(getEffectiveThresholds().cpuWarning).toBe(70)
    })
  })

  describe('getEffectiveCleanupRules', () => {
    it('should return global rules when no active profile', () => {
      expect(getEffectiveCleanupRules()).toEqual(DEFAULT_SETTINGS.automation.rules)
    })

    it('should return profile rules when active', () => {
      mockGetSettings.mockReturnValue(createMockSettings({
        profiles: [createTestProfile()], activeProfileId: 'profile-1'
      }))
      expect(getEffectiveCleanupRules()[0].id).toBe('npm_cache')
    })
  })
})
