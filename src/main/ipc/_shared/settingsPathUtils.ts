export { isPathInsideAnyParent, isPathInsideParent } from '../../utils/pathSafety'

export function didShellOpenPathFail(result: string): boolean {
  return result.trim().length > 0
}
