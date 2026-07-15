import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { MetricPoint } from '../../src/shared/types/metric'
import { MetricLogStore } from '../../src/main/services/history/metricLogStore'
import { AppendOnlyLogStore } from '../../src/main/services/core/appendOnlyLogStore'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

function point(ts: number, cpu: number): MetricPoint {
  return {
    ts,
    cpu,
    memory: 20,
    memoryUsedBytes: 2,
    memoryTotalBytes: 10,
    diskUsagePercent: 30,
    diskReadBytesPerSec: 0,
    diskWriteBytesPerSec: 0,
    networkRxBytesPerSec: 0,
    networkTxBytesPerSec: 0,
  }
}

async function createPaths(): Promise<{ filePath: string; legacyPath: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-metrics-'))
  roots.push(root)
  return {
    filePath: path.join(root, 'metrics.ndjson'),
    legacyPath: path.join(root, 'metrics.json'),
  }
}

describe('MetricLogStore', () => {
  it('appends individual points without rewriting the existing log', async () => {
    const paths = await createPaths()
    const store = new MetricLogStore(paths.filePath, paths.legacyPath, 24 * 60 * 60 * 1000)
    const now = Date.now()

    await store.append(point(now, 10))
    await store.append(point(now + 1, 20))

    const lines = (await fs.readFile(paths.filePath, 'utf-8')).trim().split('\n')
    expect(lines).toHaveLength(2)
    expect((await store.load()).map((entry) => entry.cpu)).toEqual([10, 20])
  })

  it('migrates the legacy JSON store and removes expired points', async () => {
    const paths = await createPaths()
    const now = Date.now()
    await fs.writeFile(paths.legacyPath, JSON.stringify({
      schemaVersion: 1,
      entries: [point(now - 10_000, 1), point(now, 2)],
    }))
    const store = new MetricLogStore(paths.filePath, paths.legacyPath, 5_000)

    await expect(store.load()).resolves.toEqual([point(now, 2)])
    await expect(fs.readFile(paths.filePath, 'utf-8')).resolves.toContain(`"cpu":2`)
    await expect(fs.access(paths.legacyPath)).rejects.toThrow()
  })

  it('supports normalized updates and clearing without JSON rewrites', async () => {
    const paths = await createPaths()
    const store = new AppendOnlyLogStore<{ id: string; timestamp: number; value: number }>({
      filePath: paths.filePath,
      legacyFilePath: paths.legacyPath,
      getTimestamp: (entry) => entry.timestamp,
      logScope: 'test-log',
      normalizeEntries: (entries) => Array.from(new Map(entries.map((entry) => [entry.id, entry])).values()),
    })

    await store.append({ id: 'one', timestamp: 1, value: 1 })
    await store.append({ id: 'one', timestamp: 2, value: 2 })
    expect(await store.load()).toEqual([{ id: 'one', timestamp: 2, value: 2 }])

    await store.clear()
    expect(await store.load()).toEqual([])
    expect(await fs.readFile(paths.filePath, 'utf-8')).toBe('')
  })

  it('recovers valid records around malformed NDJSON lines and compacts the file', async () => {
    const paths = await createPaths()
    const now = Date.now()
    await fs.writeFile(paths.filePath, [
      JSON.stringify(point(now, 10)),
      '{broken',
      JSON.stringify(point(now + 1, 20)),
      '',
    ].join('\n'))
    const store = new MetricLogStore(paths.filePath, paths.legacyPath, 60_000)

    expect((await store.load()).map((entry) => entry.cpu)).toEqual([10, 20])
    const lines = (await fs.readFile(paths.filePath, 'utf-8')).trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines.every((line) => { JSON.parse(line); return true })).toBe(true)
  })

  it('serializes concurrent appends and atomically replaces all records', async () => {
    const paths = await createPaths()
    const store = new MetricLogStore(paths.filePath, paths.legacyPath, 60_000)
    const now = Date.now()

    await Promise.all(Array.from({ length: 20 }, (_, index) => store.append(point(now + index, index))))
    expect(await store.load()).toHaveLength(20)

    await store.replaceAll([point(now + 100, 99)])
    expect((await store.load()).map((entry) => entry.cpu)).toEqual([99])
    expect((await fs.readFile(paths.filePath, 'utf-8')).trim().split('\n')).toHaveLength(1)
  })
})
