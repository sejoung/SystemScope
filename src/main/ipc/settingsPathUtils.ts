import * as path from 'path'

export function isPathInsideParent(targetPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, targetPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function didShellOpenPathFail(result: string): boolean {
  return result.trim().length > 0
}
