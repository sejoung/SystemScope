import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { logWarn } from './logging'

const COMPACTION_INTERVAL_MS = 60 * 60 * 1000

interface LegacyStore<T> {
  entries?: T[]
}

export interface AppendOnlyLogStoreOptions<T> {
  filePath: string
  legacyFilePath: string
  maxAgeMs?: number
  maxEntries?: number
  getTimestamp: (entry: T) => number
  logScope: string
}

/** Append-only NDJSON persistence with bounded retention and legacy JSON migration. */
export class AppendOnlyLogStore<T> {
  private entries: T[] = []
  private loaded = false
  private loadPromise: Promise<void> | null = null
  private writeQueue: Promise<void> = Promise.resolve()
  private lastCompactedAt = 0
  private needsCompaction = false

  constructor(private readonly options: AppendOnlyLogStoreOptions<T>) {}

  async load(): Promise<T[]> {
    if (!this.loaded) {
      this.loadPromise ??= this.loadFromDisk().finally(() => {
        this.loadPromise = null
      })
      await this.loadPromise
    }
    return this.getRetainedEntries()
  }

  async append(entry: T): Promise<void> {
    return this.appendBatch([entry])
  }

  async appendBatch(entries: T[]): Promise<void> {
    if (entries.length === 0) return
    await this.load()
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      await fsp.mkdir(path.dirname(this.options.filePath), { recursive: true })
      const content = entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'
      await fsp.appendFile(this.options.filePath, content, { encoding: 'utf-8', mode: 0o600 })
      this.entries.push(...entries)
      let latestTimestamp = Number.NEGATIVE_INFINITY
      for (const entry of entries) latestTimestamp = Math.max(latestTimestamp, this.options.getTimestamp(entry))
      if (this.shouldCompact(latestTimestamp)) await this.compact()
    })
    return this.writeQueue
  }

  async flush(): Promise<void> {
    await this.writeQueue
  }

  private async loadFromDisk(): Promise<void> {
    await fsp.mkdir(path.dirname(this.options.filePath), { recursive: true })
    const current = await this.readCurrentFile()
    if (current !== null) {
      this.entries = current
    } else {
      this.entries = await this.readLegacyFile()
      if (this.entries.length > 0) {
        await this.compact()
        await fsp.rm(this.options.legacyFilePath, { force: true }).catch(() => undefined)
      }
    }

    this.loaded = true
    if (this.needsCompaction || this.entries.length !== this.getRetainedEntries().length) {
      await this.compact()
    }
  }

  private async readCurrentFile(): Promise<T[] | null> {
    let raw: string
    try {
      raw = await fsp.readFile(this.options.filePath, 'utf-8')
    } catch (error) {
      if (isMissingFile(error)) return null
      throw error
    }

    const entries: T[] = []
    let invalidLineCount = 0
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as T
        if (this.isValidEntry(parsed)) entries.push(parsed)
        else invalidLineCount += 1
      } catch {
        invalidLineCount += 1
      }
    }
    if (invalidLineCount > 0) {
      this.needsCompaction = true
      logWarn(this.options.logScope, 'Skipped invalid append-only log lines', { invalidLineCount })
    }
    return entries
  }

  private async readLegacyFile(): Promise<T[]> {
    try {
      const raw = await fsp.readFile(this.options.legacyFilePath, 'utf-8')
      const parsed = JSON.parse(raw) as LegacyStore<T>
      return Array.isArray(parsed.entries) ? parsed.entries.filter((entry) => this.isValidEntry(entry)) : []
    } catch (error) {
      if (!isMissingFile(error)) logWarn(this.options.logScope, 'Failed to migrate legacy log store', { error })
      return []
    }
  }

  private isValidEntry(entry: T): boolean {
    try {
      return Number.isFinite(this.options.getTimestamp(entry))
    } catch {
      return false
    }
  }

  private getRetainedEntries(): T[] {
    let retained = this.entries
    if (this.options.maxAgeMs !== undefined) {
      const cutoff = Date.now() - this.options.maxAgeMs
      retained = retained.filter((entry) => this.options.getTimestamp(entry) >= cutoff)
    }
    if (this.options.maxEntries !== undefined && retained.length > this.options.maxEntries) {
      retained = retained.slice(retained.length - this.options.maxEntries)
    }
    return [...retained]
  }

  private shouldCompact(now: number): boolean {
    if (this.options.maxEntries !== undefined && this.entries.length > this.options.maxEntries) return true
    if (now - this.lastCompactedAt < COMPACTION_INTERVAL_MS || this.options.maxAgeMs === undefined) return false
    return (this.entries[0] ? this.options.getTimestamp(this.entries[0]) : now) < now - this.options.maxAgeMs
  }

  private async compact(): Promise<void> {
    this.entries = this.getRetainedEntries()
    const tempPath = `${this.options.filePath}.tmp-${process.pid}`
    const content = this.entries.map((entry) => JSON.stringify(entry)).join('\n')
    try {
      await fsp.writeFile(tempPath, content ? `${content}\n` : '', { encoding: 'utf-8', mode: 0o600 })
      await fsp.rename(tempPath, this.options.filePath)
      this.lastCompactedAt = Date.now()
      this.needsCompaction = false
    } finally {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined)
    }
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
