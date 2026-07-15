import * as fs from 'node:fs'
import * as path from 'node:path'

export function isPathInsideParent(targetPath: string, parentPath: string): boolean {
  let realTarget: string
  let realParent: string

  try {
    realTarget = fs.realpathSync(targetPath)
  } catch {
    try {
      fs.lstatSync(targetPath)
      return false
    } catch {
      realTarget = path.resolve(targetPath)
    }
  }

  try {
    realParent = fs.realpathSync(parentPath)
  } catch {
    realParent = path.resolve(parentPath)
  }

  const relative = path.relative(realParent, realTarget)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function isPathInsideAnyParent(
  targetPath: string,
  parentPaths: Array<string | undefined | null>
): boolean {
  return parentPaths
    .filter((parentPath): parentPath is string => typeof parentPath === 'string' && parentPath.length > 0)
    .some((parentPath) => isPathInsideParent(targetPath, parentPath))
}
