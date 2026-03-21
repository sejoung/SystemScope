import { describe, expect, it } from 'vitest'
import { DEFAULT_THRESHOLDS } from '../../src/shared/types'
import {
  DEFAULT_SETTINGS,
  isAlertThresholds,
  sanitizeAppSettings,
  validatePartialSettings
} from '../../src/main/store/settingsSchema'

describe('settingsSchema', () => {
  it('should accept valid thresholds', () => {
    expect(isAlertThresholds(DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('should reject thresholds with missing keys or invalid ranges', () => {
    expect(isAlertThresholds({ diskWarning: 80 })).toBe(false)
    expect(isAlertThresholds({ ...DEFAULT_THRESHOLDS, diskCritical: 101 })).toBe(false)
  })

  it('should sanitize malformed persisted settings with safe defaults', () => {
    const sanitized = sanitizeAppSettings({
      thresholds: { diskWarning: 80 },
      theme: 'broken'
    })

    expect(sanitized).toEqual(DEFAULT_SETTINGS)
  })

  it('should allow valid partial settings payloads only', () => {
    expect(validatePartialSettings({ theme: 'light' })).toBe(true)
    expect(validatePartialSettings({ thresholds: DEFAULT_THRESHOLDS })).toBe(true)
    expect(validatePartialSettings({ theme: 'blue' })).toBe(false)
    expect(validatePartialSettings({ thresholds: { ...DEFAULT_THRESHOLDS, memoryWarning: -1 } })).toBe(false)
  })
})
