import { describe, it, expect } from 'vitest'
import { success, failure } from '../../src/shared/types/ipc'

describe('AppResult helpers', () => {
  it('success should return ok: true with data', () => {
    const result = success({ value: 42 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({ value: 42 })
    }
  })

  it('failure should return ok: false with error', () => {
    const result = failure('INVALID_INPUT', 'bad input')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error?.code).toBe('INVALID_INPUT')
      expect(result.error?.message).toBe('bad input')
    }
  })

  it('failure should include optional details', () => {
    const result = failure('SCAN_FAILED', 'scan error', { path: '/test' })
    if (!result.ok) {
      expect(result.error?.details).toEqual({ path: '/test' })
    }
  })
})
