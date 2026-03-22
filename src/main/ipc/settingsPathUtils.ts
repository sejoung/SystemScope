import * as path from 'path'
import * as fs from 'fs'

export function isPathInsideParent(targetPath: string, parentPath: string): boolean {
  // fs.realpathSync로 심볼릭 링크를 해석하여 실제 경로 기반으로 비교
  let realTarget: string
  let realParent: string
  try {
    realTarget = fs.realpathSync(targetPath)
  } catch {
    // 경로가 존재하지 않으면 resolve로 대체
    realTarget = path.resolve(targetPath)
  }
  try {
    realParent = fs.realpathSync(parentPath)
  } catch {
    realParent = path.resolve(parentPath)
  }
  const relative = path.relative(realParent, realTarget)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function didShellOpenPathFail(result: string): boolean {
  return result.trim().length > 0
}
