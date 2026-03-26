import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PATH_TTL_MS = 2 * 60 * 60 * 1000

async function loadModule() {
  const mod = await import('../../src/main/services/shellPathRegistry')
  return mod
}

describe('shellPathRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('registerShellPath / isShellPathRegistered - exact matching', () => {
    it('returns true for a registered exact path', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/test-dir', 'exact')
      expect(isShellPathRegistered('/tmp/test-dir')).toBe(true)
    })

    it('returns false for an unregistered path', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/test-dir', 'exact')
      expect(isShellPathRegistered('/tmp/other-dir')).toBe(false)
    })

    it('exact permission does not match child paths', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/test-dir', 'exact')
      expect(isShellPathRegistered('/tmp/test-dir/child')).toBe(false)
    })
  })

  describe('descendant matching', () => {
    it('matches the registered path itself', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/project', 'descendant')
      expect(isShellPathRegistered('/tmp/project')).toBe(true)
    })

    it('matches a child path under the registered directory', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/project', 'descendant')
      expect(isShellPathRegistered('/tmp/project/src/index.ts')).toBe(true)
    })

    it('does not match a parent path', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/project/src', 'descendant')
      expect(isShellPathRegistered('/tmp/project')).toBe(false)
    })

    it('does not match a sibling path', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/project-a', 'descendant')
      expect(isShellPathRegistered('/tmp/project-b')).toBe(false)
    })
  })

  describe('path traversal attempts', () => {
    it('rejects paths that traverse above the registered directory via ..', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/project', 'descendant')
      expect(isShellPathRegistered('/tmp/project/../secret')).toBe(false)
    })

    it('rejects deeply nested traversal attempts', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/project', 'descendant')
      expect(isShellPathRegistered('/tmp/project/a/../../secret')).toBe(false)
    })

    it('allows .. segments that stay within the registered tree', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/project', 'descendant')
      // /tmp/project/a/../b resolves to /tmp/project/b which is still a descendant
      expect(isShellPathRegistered('/tmp/project/a/../b')).toBe(true)
    })
  })

  describe('TTL expiry', () => {
    it('returns true before TTL expires', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/test-dir', 'exact')

      vi.advanceTimersByTime(PATH_TTL_MS - 1)
      expect(isShellPathRegistered('/tmp/test-dir')).toBe(true)
    })

    it('returns false after TTL expires', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/test-dir', 'exact')

      vi.advanceTimersByTime(PATH_TTL_MS + 1)
      expect(isShellPathRegistered('/tmp/test-dir')).toBe(false)
    })

    it('expired entries are cleaned up during isShellPathRegistered', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/old', 'descendant')

      vi.advanceTimersByTime(PATH_TTL_MS + 1)

      // The expired descendant entry should not match a child path
      expect(isShellPathRegistered('/tmp/old/child')).toBe(false)
    })
  })

  describe('permission stickiness', () => {
    it('re-registering an exact path as exact keeps it exact', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/dir', 'exact')
      registerShellPath('/tmp/dir', 'exact')

      expect(isShellPathRegistered('/tmp/dir')).toBe(true)
      expect(isShellPathRegistered('/tmp/dir/child')).toBe(false)
    })

    it('upgrading from exact to descendant works', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/dir', 'exact')
      expect(isShellPathRegistered('/tmp/dir/child')).toBe(false)

      registerShellPath('/tmp/dir', 'descendant')
      expect(isShellPathRegistered('/tmp/dir/child')).toBe(true)
    })

    it('descendant does not downgrade to exact on re-register', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      registerShellPath('/tmp/dir', 'descendant')
      registerShellPath('/tmp/dir', 'exact')

      // Should still match children because descendant is sticky
      expect(isShellPathRegistered('/tmp/dir/child')).toBe(true)
    })
  })

  describe('pruning when exceeding MAX_REGISTERED_PATHS', () => {
    it('removes the oldest entries when limit is exceeded', async () => {
      const { registerShellPath, isShellPathRegistered } = await loadModule()
      const MAX = 5000

      // Register MAX paths
      for (let i = 0; i < MAX; i++) {
        registerShellPath(`/tmp/path-${i}`, 'exact')
      }

      // The first registered path should still exist
      expect(isShellPathRegistered('/tmp/path-0')).toBe(true)

      // Register one more to exceed the limit
      registerShellPath('/tmp/overflow', 'exact')

      // The oldest entry (path-0) should have been pruned
      expect(isShellPathRegistered('/tmp/path-0')).toBe(false)
      // The newest entry should exist
      expect(isShellPathRegistered('/tmp/overflow')).toBe(true)
    })
  })

  describe('registerShellPaths', () => {
    it('registers multiple paths at once', async () => {
      const { registerShellPaths, isShellPathRegistered } = await loadModule()
      registerShellPaths(['/tmp/a', '/tmp/b', '/tmp/c'], 'exact')

      expect(isShellPathRegistered('/tmp/a')).toBe(true)
      expect(isShellPathRegistered('/tmp/b')).toBe(true)
      expect(isShellPathRegistered('/tmp/c')).toBe(true)
    })

    it('registers multiple paths with descendant permission', async () => {
      const { registerShellPaths, isShellPathRegistered } = await loadModule()
      registerShellPaths(['/tmp/project'], 'descendant')

      expect(isShellPathRegistered('/tmp/project/src/file.ts')).toBe(true)
    })

    it('defaults to exact permission when not specified', async () => {
      const { registerShellPaths, isShellPathRegistered } = await loadModule()
      registerShellPaths(['/tmp/dir'])

      expect(isShellPathRegistered('/tmp/dir')).toBe(true)
      expect(isShellPathRegistered('/tmp/dir/child')).toBe(false)
    })

    it('accepts any iterable', async () => {
      const { registerShellPaths, isShellPathRegistered } = await loadModule()
      const pathSet = new Set(['/tmp/x', '/tmp/y'])
      registerShellPaths(pathSet, 'exact')

      expect(isShellPathRegistered('/tmp/x')).toBe(true)
      expect(isShellPathRegistered('/tmp/y')).toBe(true)
    })
  })

  describe('empty and whitespace strings', () => {
    it('ignores empty strings in registerShellPaths', async () => {
      const { registerShellPaths, isShellPathRegistered } = await loadModule()
      registerShellPaths(['', '/tmp/valid', ''], 'exact')

      expect(isShellPathRegistered('/tmp/valid')).toBe(true)
    })

    it('ignores whitespace-only strings in registerShellPaths', async () => {
      const { registerShellPaths, isShellPathRegistered } = await loadModule()
      registerShellPaths(['   ', '\t', '/tmp/valid'], 'exact')

      expect(isShellPathRegistered('/tmp/valid')).toBe(true)
    })

    it('does not register whitespace-only paths', async () => {
      const { registerShellPaths, isShellPathRegistered } = await loadModule()
      registerShellPaths(['  ', ''], 'descendant')

      // Resolved empty/whitespace would be cwd; confirm nothing blows up
      // and the valid-check path returns false
      expect(isShellPathRegistered('/tmp/not-registered')).toBe(false)
    })
  })
})
