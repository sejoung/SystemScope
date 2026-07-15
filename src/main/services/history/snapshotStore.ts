import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { logError, logWarn } from '@main/services/core/logging'
import { getSettings } from '../../store/settingsStore'
import { AppendOnlyLogStore } from '@main/services/core/appendOnlyLogStore'

export interface FolderSnapshot {
  name: string
  path: string
  size: number
}

export interface Snapshot {
  timestamp: number
  folders: FolderSnapshot[]
  totalSize: number
}

interface SnapshotData {
  version: 1
  snapshots: Snapshot[]
}

const MIN_RETENTION_SNAPSHOTS = 168 // 60분 기준 7일치
const RETENTION_WINDOW_MINUTES = 7 * 24 * 60
let saveQueue: Promise<void> = Promise.resolve()
let snapshotStore: AppendOnlyLogStore<Snapshot> | null = null
let snapshotStoreKey: string | null = null
let legacyValidation: Promise<void> | null = null

function getSnapshotDir(): string {
  return path.join(app.getPath('userData'), 'snapshots')
}

function getSnapshotFile(): string {
  return path.join(getSnapshotDir(), 'growth.ndjson')
}

function getLegacySnapshotFile(): string {
  return path.join(getSnapshotDir(), 'growth.json')
}

export function ensureSnapshotDir(): void {
  const dir = getSnapshotDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export async function loadSnapshots(): Promise<Snapshot[]> {
  const store = await getSnapshotStore()
  return store.load()
}

export function saveSnapshot(snapshot: Snapshot): Promise<void> {
  saveQueue = saveQueue.catch(() => undefined).then(async () => {
    const store = await getSnapshotStore()
    const loaded = await loadSnapshots()
    const latest = loaded[loaded.length - 1]
    if (latest && areSnapshotsEquivalent(latest, snapshot)) return

    try {
      await store.append(snapshot)
    } catch (err) {
      logError('snapshot-store', 'Failed to save snapshot', err)
      throw err
    }
  })

  return saveQueue
}

export function getMaxSnapshots(intervalMinutes = getSettings().snapshotIntervalMin): number {
  return Math.max(MIN_RETENTION_SNAPSHOTS, Math.ceil(RETENTION_WINDOW_MINUTES / intervalMinutes) + 1)
}

export async function getSnapshotsInRange(since: number): Promise<Snapshot[]> {
  const snapshots = await loadSnapshots()
  return snapshots.filter((s) => s.timestamp >= since)
}

export function parseSnapshotData(raw: string): SnapshotData | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null

  const snapshotData = data as Partial<SnapshotData>
  if (snapshotData.version !== 1 || !Array.isArray(snapshotData.snapshots)) {
    return null
  }

  return snapshotData as SnapshotData
}

export function areSnapshotsEquivalent(a: Snapshot, b: Snapshot): boolean {
  if (a.totalSize !== b.totalSize) return false
  if (a.folders.length !== b.folders.length) return false

  // 순서에 무관하게 비교하기 위해 path를 키로 사용
  const bMap = new Map(b.folders.map((f) => [f.path, f]))
  for (const left of a.folders) {
    const right = bMap.get(left.path)
    if (!right || left.name !== right.name || left.size !== right.size) {
      return false
    }
  }

  return true
}

function backupCorruptSnapshotFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return
    const backupPath = `${filePath}.corrupt-${Date.now()}`
    fs.renameSync(filePath, backupPath)
    logWarn('snapshot-store', 'Backed up corrupt snapshot file', { backupPath })
  } catch (backupErr) {
    logWarn('snapshot-store', 'Failed to back up corrupt snapshot file', backupErr)
  }
}

async function getSnapshotStore(): Promise<AppendOnlyLogStore<Snapshot>> {
  const filePath = getSnapshotFile()
  const maxEntries = getMaxSnapshots()
  const storeKey = `${filePath}:${maxEntries}`
  if (!snapshotStore || snapshotStoreKey !== storeKey) {
    snapshotStoreKey = storeKey
    legacyValidation = validateLegacySnapshotFile(getLegacySnapshotFile())
    snapshotStore = new AppendOnlyLogStore<Snapshot>({
      filePath,
      legacyFilePath: getLegacySnapshotFile(),
      maxEntries,
      getTimestamp: (snapshot) => snapshot.timestamp,
      logScope: 'snapshot-store',
      parseLegacyEntries: (raw) => parseSnapshotData(raw)?.snapshots ?? null
    })
  }
  await legacyValidation
  return snapshotStore
}

async function validateLegacySnapshotFile(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) return
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    if (parseSnapshotData(raw)) return
    logWarn('snapshot-store', 'Invalid snapshot file detected, backing it up and starting fresh')
    backupCorruptSnapshotFile(filePath)
  } catch (error) {
    logWarn('snapshot-store', 'Failed to validate legacy snapshots, backing them up', error)
    backupCorruptSnapshotFile(filePath)
  }
}
