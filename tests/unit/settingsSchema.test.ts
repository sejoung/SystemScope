import { describe, expect, it } from 'vitest'
import { DEFAULT_THRESHOLDS } from '../../src/shared/types'
import {
  DEFAULT_SETTINGS,
  sanitizeAppSettings,
  validatePartialSettings
} from '../../src/main/store/settingsSchema'

describe('settingsSchema', () => {
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
    expect(validatePartialSettings({ thresholds: { diskWarning: 80 } })).toBe(false)
  })
})
