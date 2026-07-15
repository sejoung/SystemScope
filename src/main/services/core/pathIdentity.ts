import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface PathIdentity {
  resolvedPath: string
  realPath: string
  device: number
  inode: number
  size: number
  modifiedAt: number
}

export async function capturePathIdentity(targetPath: string): Promise<PathIdentity | null> {
  try {
    const resolvedPath = path.resolve(targetPath)
    const stat = await fs.lstat(resolvedPath)
    if (stat.isSymbolicLink()) {
      return null
    }
    return {
      resolvedPath,
      realPath: await fs.realpath(resolvedPath),
      device: stat.dev,
      inode: stat.ino,
      size: stat.size,
      modifiedAt: stat.mtimeMs
    }
  } catch {
    return null
  }
}

export async function pathIdentityMatches(expected: PathIdentity): Promise<boolean> {
  const current = await capturePathIdentity(expected.resolvedPath)
  return Boolean(current
    && current.realPath === expected.realPath
    && current.device === expected.device
    && current.inode === expected.inode
    && current.size === expected.size
    && current.modifiedAt === expected.modifiedAt)
}
