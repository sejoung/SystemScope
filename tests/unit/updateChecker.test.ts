import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.1.2',
    isPackaged: false
  },
  BrowserWindow: {
    getAllWindows: () => []
  },
  shell: {
    openExternal: vi.fn()
  }
}))

import { compareVersions, normalizeVersion, parseLatestRelease } from '../../src/main/services/updateChecker'

describe('updateChecker', () => {
  describe('compareVersions', () => {
    it('should compare normalized semver values correctly', () => {
      expect(compareVersions('1.2.0', '1.1.9')).toBe(1)
      expect(compareVersions('1.2.0', '1.2.0')).toBe(0)
      expect(compareVersions('1.2.0', '1.2.1')).toBe(-1)
      expect(compareVersions('v1.2.0', '1.1.9')).toBe(1)
    })

    it('should return null for invalid versions', () => {
      expect(compareVersions('1.2', '1.2.0')).toBeNull()
      expect(compareVersions('latest', '1.2.0')).toBeNull()
    })
  })

  describe('normalizeVersion', () => {
    it('should strip a leading v and keep valid semver', () => {
      expect(normalizeVersion('v1.2.3')).toBe('1.2.3')
      expect(normalizeVersion('1.2.3-beta.1')).toBe('1.2.3-beta.1')
    })

    it('should reject invalid version strings', () => {
      expect(normalizeVersion('1.2')).toBeNull()
      expect(normalizeVersion(null)).toBeNull()
    })
  })

  describe('parseLatestRelease', () => {
    it('should parse a valid GitHub release response with an available update', () => {
      const parsed = parseLatestRelease(
        {
          tag_name: 'v1.3.0',
          html_url: 'https://github.com/sejoung/SystemScope/releases/tag/v1.3.0',
          body: 'Bug fixes',
          published_at: '2026-03-25T10:00:00.000Z'
        },
        '1.2.0'
      )

      expect(parsed).toEqual({
        currentVersion: '1.2.0',
        latestVersion: '1.3.0',
        hasUpdate: true,
        releaseUrl: 'https://sejoung.github.io/SystemScope/',
        releaseNotes: 'Bug fixes',
        publishedAt: '2026-03-25T10:00:00.000Z'
      })
    })

    it('should parse a valid GitHub release response with no update', () => {
      const parsed = parseLatestRelease(
        {
          tag_name: 'v1.2.0',
          html_url: 'https://github.com/sejoung/SystemScope/releases/tag/v1.2.0',
          body: '',
          published_at: '2026-03-25T10:00:00.000Z'
        },
        '1.2.0'
      )

      expect(parsed?.hasUpdate).toBe(false)
      expect(parsed?.latestVersion).toBe('1.2.0')
    })

    it('should reject malformed payloads', () => {
      expect(
        parseLatestRelease(
          {
            tag_name: 'v1.3.0',
            html_url: 'https://example.com/releases/tag/v1.3.0',
            body: 'Bug fixes',
            published_at: null
          },
          '1.2.0'
        )
      ).toBeNull()

      expect(
        parseLatestRelease(
          {
            tag_name: 'next',
            html_url: 'https://github.com/sejoung/SystemScope/releases/tag/next',
            body: 'Bug fixes',
            published_at: '2026-03-25T10:00:00.000Z'
          },
          '1.2.0'
        )
      ).toBeNull()
    })
  })
})
