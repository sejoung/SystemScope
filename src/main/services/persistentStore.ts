import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import { logError, logWarn } from './logging'

interface StoreData<T> {
  schemaVersion: number
  entries: T[]
}

export interface PersistentStoreOptions<T> {
  filePath: string
  schemaVersion: number
  maxEntries?: number
  maxAgeMs?: number
  /** Extract a timestamp (epoch ms) from an entry for age-based retention. Required if maxAgeMs is set. */
  getTimestamp?: (entry: T) => number
}

export class PersistentStore<T> {
  private readonly filePath: string
  private readonly schemaVersion: number
  private readonly maxEntries: number | undefined
  private readonly maxAgeMs: number | undefined
  private readonly getTimestamp: ((entry: T) => number) | undefined

  private cachedEntries: T[] | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(options: PersistentStoreOptions<T>) {
    this.filePath = options.filePath
    this.schemaVersion = options.schemaVersion
    this.maxEntries = options.maxEntries
    this.maxAgeMs = options.maxAgeMs
    this.getTimestamp = options.getTimestamp
  }

  async load(): Promise<T[]> {
    if (this.cachedEntries) return this.cachedEntries

    try {
      try {
        await fsp.access(this.filePath)
      } catch {
        this.cachedEntries = []
        return this.cachedEntries
      }

      const raw = await fsp.readFile(this.filePath, 'utf-8')
      const data = this.parseStoreData(raw)

      if (!data) {
        logWarn('persistent-store', 'Invalid store file detected, backing up and starting fresh', {
          filePath: this.filePath
        })
        this.backupCorruptFile()
        this.cachedEntries = []
        return this.cachedEntries
      }

      this.cachedEntries = data.entries
      const removed = this.applyRetentionToCache()
      if (removed > 0) {
        await this.flush()
      }

      return this.cachedEntries
    } catch (err) {
      logWarn('persistent-store', 'Failed to load store file, starting fresh', {
        filePath: this.filePath,
        error: err
      })
      this.backupCorruptFile()
      this.cachedEntries = []
      return this.cachedEntries
    }
  }

  async append(entry: T): Promise<void> {
    return this.appendBatch([entry])
  }

  async appendBatch(entries: T[]): Promise<void> {
    if (entries.length === 0) return

    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const current = await this.load()
      const updated = [...current, ...entries]
      this.cachedEntries = updated
      this.applyRetentionToCache()
      await this.flush()
    })

    return this.writeQueue
  }

  async clear(): Promise<void> {
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      this.cachedEntries = []
      await this.flush()
    })

    return this.writeQueue
  }

  async applyRetention(): Promise<number> {
    let removed = 0

    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      await this.load()
      removed = this.applyRetentionToCache()
      if (removed > 0) {
        await this.flush()
      }
    })

    await this.writeQueue
    return removed
  }

  private parseStoreData(raw: string): StoreData<T> | null {
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return null
    }

    if (!data || typeof data !== 'object') return null

    const storeData = data as Partial<StoreData<T>>
    if (storeData.schemaVersion !== this.schemaVersion || !Array.isArray(storeData.entries)) {
      return null
    }

    return storeData as StoreData<T>
  }

  /** Apply retention policy to the in-memory cache. Returns the number of entries removed. */
  private applyRetentionToCache(): number {
    if (!this.cachedEntries) return 0

    const before = this.cachedEntries.length

    if (this.maxAgeMs !== null && this.maxAgeMs !== undefined && this.getTimestamp) {
      const cutoff = Date.now() - this.maxAgeMs
      const getTs = this.getTimestamp
      this.cachedEntries = this.cachedEntries.filter((entry) => getTs(entry) >= cutoff)
    }

    if (this.maxEntries !== null && this.maxEntries !== undefined && this.cachedEntries.length > this.maxEntries) {
      this.cachedEntries = this.cachedEntries.slice(this.cachedEntries.length - this.maxEntries)
    }

    return before - this.cachedEntries.length
  }

  private async flush(): Promise<void> {
    const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'))
    const tempPath = this.getTempPath()

    await fsp.mkdir(dir, { recursive: true })

    const data: StoreData<T> = {
      schemaVersion: this.schemaVersion,
      entries: this.cachedEntries ?? []
    }

    try {
      await fsp.writeFile(tempPath, JSON.stringify(data, null, 2), {
        encoding: 'utf-8',
        mode: 0o600
      })
      await fsp.rename(tempPath, this.filePath)
    } catch (err) {
      logError('persistent-store', 'Failed to write store file', {
        filePath: this.filePath,
        error: err
      })
      throw err
    } finally {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined)
    }
  }

  private backupCorruptFile(): void {
    try {
      if (!fs.existsSync(this.filePath)) return
      const backupPath = `${this.filePath}.corrupt-${Date.now()}`
      fs.renameSync(this.filePath, backupPath)
      logWarn('persistent-store', 'Backed up corrupt store file', { backupPath })
    } catch (backupErr) {
      logWarn('persistent-store', 'Failed to back up corrupt store file', backupErr)
    }
  }

  private getTempPath(): string {
    return `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  }
}
