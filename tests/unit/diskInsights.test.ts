import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { findDuplicates } from '../../src/main/services/diskInsights'

const tempRoots: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-disk-insights-'))
  tempRoots.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('findDuplicates', () => {
  it('should not report different large files as duplicates when only head/tail match', async () => {
    const dir = await makeTempDir()
    const head = Buffer.alloc(8192, 'A')
    const middleA = Buffer.alloc(8192, 'B')
    const middleB = Buffer.alloc(8192, 'C')
    const tail = Buffer.alloc(8192, 'D')

    await fs.writeFile(path.join(dir, 'file-a.bin'), Buffer.concat([head, middleA, tail]))
    await fs.writeFile(path.join(dir, 'file-b.bin'), Buffer.concat([head, middleB, tail]))

    const results = await findDuplicates(dir, 1)

    expect(results).toHaveLength(0)
  })

  it('should still report true duplicates', async () => {
    const dir = await makeTempDir()
    const content = Buffer.concat([
      Buffer.alloc(8192, 'X'),
      Buffer.alloc(8192, 'Y'),
      Buffer.alloc(8192, 'Z')
    ])

    await fs.writeFile(path.join(dir, 'copy-a.bin'), content)
    await fs.writeFile(path.join(dir, 'copy-b.bin'), content)

    const results = await findDuplicates(dir, 1)

    expect(results).toHaveLength(1)
    expect(results[0].files).toHaveLength(2)
    expect(results[0].totalWaste).toBe(content.length)
  })
})
