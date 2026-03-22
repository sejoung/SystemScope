import { beforeEach, describe, expect, it } from 'vitest'
import { useDiskStore } from '../../src/renderer/src/stores/useDiskStore'

describe('useDiskStore', () => {
  beforeEach(() => {
    useDiskStore.setState({
      scanResult: null,
      largeFiles: [],
      extensions: [],
      isScanning: false,
      scanJobId: null,
      scanProgress: '',
      selectedFolder: null,
      userSpace: null,
      userSpaceLoading: false,
      growthView: null,
      growthViewLoading: false,
      growthViewPeriod: '7d'
    })
  })

  it('should remove deleted files from the large file list immediately', () => {
    useDiskStore.setState({
      largeFiles: [
        { name: 'a.zip', path: '/tmp/a.zip', size: 100, modified: 1 },
        { name: 'b.zip', path: '/tmp/b.zip', size: 200, modified: 2 },
        { name: 'c.zip', path: '/tmp/c.zip', size: 300, modified: 3 }
      ]
    })

    useDiskStore.getState().removeLargeFilesByPaths(['/tmp/a.zip', '/tmp/c.zip'])

    expect(useDiskStore.getState().largeFiles).toEqual([
      { name: 'b.zip', path: '/tmp/b.zip', size: 200, modified: 2 }
    ])
  })
})
