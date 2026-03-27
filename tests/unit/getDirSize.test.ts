import { beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => vi.fn(() => 'win32'))
const readdir = vi.hoisted(() => vi.fn())
const stat = vi.hoisted(() => vi.fn())

vi.mock('os', () => ({
  platform
}))

vi.mock('fs/promises', () => ({
  default: {},
  readdir,
  stat
}))

vi.mock('../../src/main/services/logging', () => ({
  logDebug: vi.fn()
}))

vi.mock('../../src/main/services/externalCommand', () => ({
  isExternalCommandError: vi.fn(() => false),
  runExternalCommand: vi.fn()
}))

type DirEntry = {
  name: string
  isSymbolicLink: () => boolean
  isFile: () => boolean
  isDirectory: () => boolean
}

function file(name: string): DirEntry {
  return {
    name,
    isSymbolicLink: () => false,
    isFile: () => true,
    isDirectory: () => false
  }
}

function dir(name: string): DirEntry {
  return {
    name,
    isSymbolicLink: () => false,
    isFile: () => false,
    isDirectory: () => true
  }
}

describe('getDirSize', () => {
  beforeEach(() => {
    vi.resetModules()
    platform.mockReturnValue('win32')
    readdir.mockReset()
    stat.mockReset()

    readdir.mockImplementation(async (targetPath: string) => {
      switch (targetPath) {
        case '/root':
          return [file('a.txt'), dir('nested')]
        case '/root/nested':
          return [dir('deep')]
        case '/root/nested/deep':
          return [file('b.txt')]
        default:
          return []
      }
    })

    stat.mockImplementation(async (targetPath: string) => {
      switch (targetPath) {
        case '/root/a.txt':
          return { size: 100 }
        case '/root/nested/deep/b.txt':
          return { size: 200 }
        default:
          throw new Error(`Unexpected stat path: ${targetPath}`)
      }
    })
  })

  it('computes the full recursive size by default', async () => {
    const { getDirSize } = await import('../../src/main/utils/getDirSize')
    await expect(getDirSize('/root')).resolves.toBe(300)
  })

  it('supports bounded estimates for faster partial scans', async () => {
    const { getDirSizeEstimate } = await import('../../src/main/utils/getDirSize')
    await expect(getDirSizeEstimate('/root', 1)).resolves.toBe(100)
  })
})
