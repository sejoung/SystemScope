import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { PersistentStore } from '../../src/main/services/core/persistentStore'

interface Entry {
  id: number
  timestamp: number
}

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

async function createStore(): Promise<PersistentStore<Entry>> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-store-'))
  roots.push(root)
  const filePath = path.join(root, 'entries.json')
  await fs.writeFile(filePath, JSON.stringify({
    schemaVersion: 1,
    entries: [{ id: 1, timestamp: 1 }]
  }))
  return new PersistentStore<Entry>({ filePath, schemaVersion: 1 })
}

describe('PersistentStore', () => {
  it('shares the initial load with a concurrent append without losing data', async () => {
    const store = await createStore()

    await Promise.all([
      store.load(),
      store.append({ id: 2, timestamp: 2 })
    ])

    expect(await store.load()).toEqual([
      { id: 1, timestamp: 1 },
      { id: 2, timestamp: 2 }
    ])
  })

  it('does not expose the mutable cache array to callers', async () => {
    const store = await createStore()
    const entries = await store.load()
    entries.push({ id: 99, timestamp: 99 })

    expect(await store.load()).toEqual([{ id: 1, timestamp: 1 }])
  })
})
