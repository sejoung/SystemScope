import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import type { MetricPoint } from '@shared/types/metric'
import { logWarn } from '@main/services/core/logging'

const COMPACTION_INTERVAL_MS = 60 * 60 * 1000

interface LegacyMetricStore {
  schemaVersion?: number
  entries?: MetricPoint[]
}

/** Append-only metric storage with periodic retention compaction. */
export class MetricLogStore {
  private entries: MetricPoint[] = []
  private loaded = false
  private loadPromise: Promise<void> | null = null
  private writeQueue: Promise<void> = Promise.resolve()
  private lastCompactedAt = 0

  constructor(
    private readonly filePath: string,
    private readonly legacyFilePath: string,
    private readonly maxAgeMs: number,
  ) {}

  async load(): Promise<MetricPoint[]> {
    if (!this.loaded) {
      this.loadPromise ??= this.loadFromDisk().finally(() => {
        this.loadPromise = null
      })
      await this.loadPromise
    }
    return this.getRetainedEntries()
  }

  async append(entry: MetricPoint): Promise<void> {
    await this.load()
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      await fsp.mkdir(path.dirname(this.filePath), { recursive: true })
      await fsp.appendFile(this.filePath, `${JSON.stringify(entry)}\n`, { encoding: 'utf-8', mode: 0o600 })
      this.entries.push(entry)
      if (this.shouldCompact(entry.ts)) await this.compact()
    })
    return this.writeQueue
  }

  async flush(): Promise<void> {
    await this.writeQueue
  }

  private async loadFromDisk(): Promise<void> {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true })
    const current = await this.readCurrentFile()
    if (current !== null) {
      this.entries = current
    } else {
      this.entries = await this.readLegacyFile()
      if (this.entries.length > 0) {
        await this.compact()
        await fsp.rm(this.legacyFilePath, { force: true }).catch(() => undefined)
      }
    }

    this.loaded = true
    if (this.entries.length !== this.getRetainedEntries().length) await this.compact()
  }

  private async readCurrentFile(): Promise<MetricPoint[] | null> {
    let raw: string
    try {
      raw = await fsp.readFile(this.filePath, 'utf-8')
    } catch (error) {
      if (isMissingFile(error)) return null
      throw error
    }

    const entries: MetricPoint[] = []
    let invalidLineCount = 0
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as MetricPoint
        if (typeof parsed.ts === 'number') entries.push(parsed)
        else invalidLineCount += 1
      } catch {
        invalidLineCount += 1
      }
    }
    if (invalidLineCount > 0) {
      logWarn('metric-log-store', 'Skipped invalid metric log lines', { invalidLineCount })
    }
    return entries
  }

  private async readLegacyFile(): Promise<MetricPoint[]> {
    try {
      const raw = await fsp.readFile(this.legacyFilePath, 'utf-8')
      const parsed = JSON.parse(raw) as LegacyMetricStore
      return Array.isArray(parsed.entries)
        ? parsed.entries.filter((entry) => typeof entry?.ts === 'number')
        : []
    } catch (error) {
      if (!isMissingFile(error)) {
        logWarn('metric-log-store', 'Failed to migrate legacy metrics', { error })
      }
      return []
    }
  }

  private getRetainedEntries(): MetricPoint[] {
    const cutoff = Date.now() - this.maxAgeMs
    return this.entries.filter((entry) => entry.ts >= cutoff)
  }

  private shouldCompact(now: number): boolean {
    if (now - this.lastCompactedAt < COMPACTION_INTERVAL_MS) return false
    return (this.entries[0]?.ts ?? now) < now - this.maxAgeMs
  }

  private async compact(): Promise<void> {
    this.entries = this.getRetainedEntries()
    const tempPath = `${this.filePath}.tmp-${process.pid}`
    const content = this.entries.map((entry) => JSON.stringify(entry)).join('\n')
    try {
      await fsp.writeFile(tempPath, content ? `${content}\n` : '', { encoding: 'utf-8', mode: 0o600 })
      await fsp.rename(tempPath, this.filePath)
      this.lastCompactedAt = Date.now()
    } finally {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined)
    }
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
