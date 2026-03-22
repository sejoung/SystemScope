import * as path from 'path'
import * as fs from 'fs'

export function isPathInsideParent(targetPath: string, parentPath: string): boolean {
  // fs.realpathSync로 심볼릭 링크를 해석하여 실제 경로 기반으로 비교
  // targetPath가 심볼릭 링크이고 realpathSync가 실패하면 경로를 거부한다
  let realTarget: string
  let realParent: string

  try {
    // 심볼릭 링크인지 먼저 확인 — 심볼릭 링크인데 realpath가 실패하면 거부
    const lstat = fs.lstatSync(targetPath)
    if (lstat.isSymbolicLink()) {
      realTarget = fs.realpathSync(targetPath)
    } else {
      realTarget = fs.realpathSync(targetPath)
    }
  } catch {
    // 경로가 존재하지 않는 경우: lstat 자체가 실패하면 resolve로 대체 허용
    // (아직 존재하지 않는 경로를 검증하는 경우)
    try {
      fs.lstatSync(targetPath)
      // lstat은 성공했지만 realpath는 실패 = 깨진 심볼릭 링크 → 거부
      return false
    } catch {
      // 경로 자체가 존재하지 않음 → resolve로 대체
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

export function didShellOpenPathFail(result: string): boolean {
  return result.trim().length > 0
}
