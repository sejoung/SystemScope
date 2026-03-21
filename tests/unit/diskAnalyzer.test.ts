import { describe, it, expect } from 'vitest'
import { findLargeFiles, getExtensionBreakdown } from '../../src/main/services/diskAnalyzer'
import type { FolderNode } from '../../src/shared/types'

function makeTree(): FolderNode {
  return {
    name: 'root',
    path: '/root',
    size: 1_000_000,
    isFile: false,
    children: [
      {
        name: 'big.zip',
        path: '/root/big.zip',
        size: 500_000,
        isFile: true,
        children: []
      },
      {
        name: 'medium.pdf',
        path: '/root/medium.pdf',
        size: 300_000,
        isFile: true,
        children: []
      },
      {
        name: 'sub',
        path: '/root/sub',
        size: 200_000,
        isFile: false,
        children: [
          {
            name: 'small.txt',
            path: '/root/sub/small.txt',
            size: 100_000,
            isFile: true,
            children: []
          },
          {
            name: 'tiny.txt',
            path: '/root/sub/tiny.txt',
            size: 50_000,
            isFile: true,
            children: []
          },
          {
            name: 'data.pdf',
            path: '/root/sub/data.pdf',
            size: 50_000,
            isFile: true,
            children: []
          }
        ]
      }
    ]
  }
}

describe('findLargeFiles', () => {
  it('should return files sorted by size descending', () => {
    const files = findLargeFiles(makeTree(), 10)
    expect(files.length).toBe(5)
    expect(files[0].name).toBe('big.zip')
    expect(files[0].size).toBe(500_000)
    expect(files[1].name).toBe('medium.pdf')
  })

  it('should respect limit', () => {
    const files = findLargeFiles(makeTree(), 2)
    expect(files.length).toBe(2)
  })

  it('should handle empty tree', () => {
    const empty: FolderNode = { name: 'empty', path: '/empty', size: 0, isFile: false, children: [] }
    const files = findLargeFiles(empty, 10)
    expect(files).toHaveLength(0)
  })
})

describe('getExtensionBreakdown', () => {
  it('should group files by extension', () => {
    const groups = getExtensionBreakdown(makeTree())
    const txtGroup = groups.find((g) => g.extension === '.txt')
    const pdfGroup = groups.find((g) => g.extension === '.pdf')
    const zipGroup = groups.find((g) => g.extension === '.zip')

    expect(txtGroup).toBeDefined()
    expect(txtGroup!.count).toBe(2)
    expect(txtGroup!.totalSize).toBe(150_000)

    expect(pdfGroup).toBeDefined()
    expect(pdfGroup!.count).toBe(2)
    expect(pdfGroup!.totalSize).toBe(350_000)

    expect(zipGroup).toBeDefined()
    expect(zipGroup!.count).toBe(1)
  })

  it('should sort by total size descending', () => {
    const groups = getExtensionBreakdown(makeTree())
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i - 1].totalSize).toBeGreaterThanOrEqual(groups[i].totalSize)
    }
  })
})
