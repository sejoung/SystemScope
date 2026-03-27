import * as path from 'path'

const MAX_REGISTERED_PATHS = 5000
const PATH_TTL_MS = 2 * 60 * 60 * 1000

interface RegisteredPath {
  path: string
  createdAt: number
}

// exact 경로는 Set 기반으로 O(1) 조회
const exactPaths = new Map<string, RegisteredPath>()
// descendant 경로는 별도 Map으로 관리 (순회 필요)
const descendantPaths = new Map<string, RegisteredPath>()

export function registerShellPath(targetPath: string, permission: 'exact' | 'descendant' = 'exact'): void {
  const resolved = path.resolve(targetPath)
  const now = Date.now()
  const entry: RegisteredPath = { path: resolved, createdAt: now }

  if (permission === 'descendant') {
    descendantPaths.set(resolved, entry)
    exactPaths.delete(resolved) // descendant가 exact를 포함
  } else if (!descendantPaths.has(resolved)) {
    exactPaths.set(resolved, entry)
  }

  pruneRegisteredPaths()
}

export function registerShellPaths(
  targetPaths: Iterable<string>,
  permission: 'exact' | 'descendant' = 'exact'
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

  // O(1) exact 조회
  const exactEntry = exactPaths.get(resolved)
  if (exactEntry) {
    if (now - exactEntry.createdAt > PATH_TTL_MS) {
      exactPaths.delete(resolved)
    } else {
      return true
    }
  }

  // descendant 경로 순회
  for (const [registeredPath, entry] of descendantPaths) {
    if (now - entry.createdAt > PATH_TTL_MS) {
      descendantPaths.delete(registeredPath)
      continue
    }

    const relative = path.relative(registeredPath, resolved)
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      return true
    }
  }

  return false
}

function pruneRegisteredPaths(): void {
  const now = Date.now()

  for (const [key, entry] of exactPaths) {
    if (now - entry.createdAt > PATH_TTL_MS) {
      exactPaths.delete(key)
    }
  }

  for (const [key, entry] of descendantPaths) {
    if (now - entry.createdAt > PATH_TTL_MS) {
      descendantPaths.delete(key)
    }
  }

  const totalSize = exactPaths.size + descendantPaths.size
  if (totalSize > MAX_REGISTERED_PATHS) {
    // exact 경로부터 오래된 것 제거
    let toRemove = totalSize - MAX_REGISTERED_PATHS
    for (const key of exactPaths.keys()) {
      if (toRemove <= 0) break
      exactPaths.delete(key)
      toRemove--
    }
    for (const key of descendantPaths.keys()) {
      if (toRemove <= 0) break
      descendantPaths.delete(key)
      toRemove--
    }
  }
}
