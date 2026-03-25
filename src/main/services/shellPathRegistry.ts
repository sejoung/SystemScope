import * as path from 'path'

const MAX_REGISTERED_PATHS = 5000
const PATH_TTL_MS = 2 * 60 * 60 * 1000

type ShellPathPermission = 'exact' | 'descendant'

interface RegisteredPath {
  path: string
  permission: ShellPathPermission
  createdAt: number
}

const registeredPaths = new Map<string, RegisteredPath>()

export function registerShellPath(targetPath: string, permission: ShellPathPermission = 'exact'): void {
  const resolved = path.resolve(targetPath)
  const existing = registeredPaths.get(resolved)
  const nextPermission =
    existing?.permission === 'descendant' || permission === 'descendant'
      ? 'descendant'
      : 'exact'

  registeredPaths.set(resolved, {
    path: resolved,
    permission: nextPermission,
    createdAt: Date.now()
  })
  pruneRegisteredPaths()
}

export function registerShellPaths(
  targetPaths: Iterable<string>,
  permission: ShellPathPermission = 'exact'
): void {
  for (const targetPath of targetPaths) {
    if (typeof targetPath === 'string' && targetPath.trim()) {
      registerShellPath(targetPath, permission)
    }
  }
}

export function isShellPathRegistered(targetPath: string): boolean {
  const resolved = path.resolve(targetPath)
  const now = Date.now()

  for (const [registeredPath, entry] of registeredPaths) {
    if (now - entry.createdAt > PATH_TTL_MS) {
      registeredPaths.delete(registeredPath)
      continue
    }

    if (entry.permission === 'exact' && registeredPath === resolved) {
      return true
    }

    if (entry.permission === 'descendant') {
      const relative = path.relative(registeredPath, resolved)
      if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
        return true
      }
    }
  }

  return false
}

function pruneRegisteredPaths(): void {
  const now = Date.now()

  for (const [registeredPath, entry] of registeredPaths) {
    if (now - entry.createdAt > PATH_TTL_MS) {
      registeredPaths.delete(registeredPath)
    }
  }

  while (registeredPaths.size > MAX_REGISTERED_PATHS) {
    const firstKey = registeredPaths.keys().next().value
    if (firstKey === undefined) break
    registeredPaths.delete(firstKey)
  }
}
