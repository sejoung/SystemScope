import { describe, expect, it } from 'vitest'
import { DEFAULT_THRESHOLDS } from '../../src/shared/types'
import {
  DEFAULT_SETTINGS,
  sanitizeAppSettings,
  validatePartialSettings,
  isCleanupRuleConfigValue,
  isWorkspaceProfileValue
} from '../../src/main/store/settingsSchema'

describe('settingsSchema', () => {
  it('should sanitize malformed persisted settings with safe defaults', () => {
    const sanitized = sanitizeAppSettings({
      thresholds: { diskWarning: 80 },
      theme: 'broken',
      locale: 'jp'
    })

    expect(sanitized).toEqual(DEFAULT_SETTINGS)
  })

  it('should allow valid partial settings payloads only', () => {
    expect(validatePartialSettings({ theme: 'light' })).toBe(true)
    expect(validatePartialSettings({ locale: 'en' })).toBe(true)
    expect(validatePartialSettings({ thresholds: DEFAULT_THRESHOLDS })).toBe(true)
    expect(validatePartialSettings({ theme: 'blue' })).toBe(false)
    expect(validatePartialSettings({ locale: 'jp' })).toBe(false)
    expect(validatePartialSettings({ thresholds: { ...DEFAULT_THRESHOLDS, memoryWarning: -1 } })).toBe(false)
    expect(validatePartialSettings({ thresholds: { diskWarning: 80 } })).toBe(false)
    expect(validatePartialSettings({
      automation: {
        schedule: { enabled: true, frequency: 'weekly' },
        rules: [{ id: 'npm_cache', enabled: true, minAgeDays: 30 }]
      }
    })).toBe(true)
    expect(validatePartialSettings({
      automation: {
        schedule: { enabled: true, frequency: 'weekly' },
        rules: [{ id: 'invalid_rule', enabled: true, minAgeDays: 30 }]
      }
    })).toBe(false)
    expect(validatePartialSettings({
      automation: {
        schedule: { enabled: true, frequency: 'weekly', lastRunAt: 'yesterday' },
        rules: [{ id: 'npm_cache', enabled: true, minAgeDays: 30 }]
      }
    })).toBe(false)
  })

  it('should validate cleanup rule configs strictly', () => {
    expect(isCleanupRuleConfigValue({ id: 'npm_cache', enabled: true, minAgeDays: 30 })).toBe(true)
    expect(isCleanupRuleConfigValue({ id: 'npm_cache', enabled: true, minAgeDays: 0 })).toBe(false)
    expect(isCleanupRuleConfigValue({ id: 'bad', enabled: true, minAgeDays: 30 })).toBe(false)
  })

  it('should validate workspace profile payloads including thresholds and cleanup rules', () => {
    const validProfile = {
      id: 'profile-1',
      name: 'Development',
      icon: 'dev',
      thresholds: DEFAULT_THRESHOLDS,
      cleanupRules: [{ id: 'npm_cache', enabled: true, minAgeDays: 14 }],
      hiddenWidgets: ['gpu'],
      workspacePaths: ['/Users/test/workspace'],
      automationSchedule: null
    }

    expect(isWorkspaceProfileValue(validProfile)).toBe(true)
    expect(isWorkspaceProfileValue({ ...validProfile, thresholds: { cpuWarning: 80 } })).toBe(false)
    expect(isWorkspaceProfileValue({ ...validProfile, cleanupRules: [{ id: 'bad', enabled: true, minAgeDays: 14 }] })).toBe(false)
    expect(isWorkspaceProfileValue({ ...validProfile, id: '' })).toBe(false)
    expect(isWorkspaceProfileValue({ ...validProfile, id: '' }, { allowEmptyId: true })).toBe(true)
  })
})
