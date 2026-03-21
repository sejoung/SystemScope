import { app } from 'electron'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import log from 'electron-log'

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

const MAX_SNAPSHOTS = 168 // 7일 x 24시간
let saveQueue: Promise<void> = Promise.resolve()

function getSnapshotDir(): string {
  return path.join(app.getPath('userData'), 'snapshots')
}

function getSnapshotFile(): string {
  return path.join(getSnapshotDir(), 'growth.json')
}

export function ensureSnapshotDir(): void {
  const dir = getSnapshotDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function loadSnapshots(): Snapshot[] {
  const filePath = getSnapshotFile()
  try {
    if (!fs.existsSync(filePath)) return []
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = parseSnapshotData(raw)
    if (!data) return []
    return data.snapshots
  } catch (err) {
    log.warn('Failed to load snapshots, starting fresh', err)
    backupCorruptSnapshotFile(filePath)
    return []
  }
}

export function saveSnapshot(snapshot: Snapshot): Promise<void> {
  saveQueue = saveQueue.catch(() => undefined).then(async () => {
    const dir = getSnapshotDir()
    const filePath = getSnapshotFile()
    const tempPath = getTempSnapshotFile(filePath)

    // 동시에 여러 저장 요청이 와도 한 번에 하나씩 순서대로 처리한다.
    await fsp.mkdir(dir, { recursive: true })

    const existing = loadSnapshots()
    const latest = existing[existing.length - 1]
    if (latest && areSnapshotsEquivalent(latest, snapshot)) {
      return
    }
    existing.push(snapshot)

    while (existing.length > MAX_SNAPSHOTS) {
      existing.shift()
    }

    const data: SnapshotData = { version: 1, snapshots: existing }

    try {
      await fsp.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
      await fsp.rename(tempPath, filePath)
    } catch (err) {
      log.error('Failed to save snapshot', err)
      throw err
    } finally {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined)
    }
  })

  return saveQueue
}

export function getSnapshotsInRange(since: number): Snapshot[] {
  return loadSnapshots().filter((s) => s.timestamp >= since)
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

  for (let i = 0; i < a.folders.length; i++) {
    const left = a.folders[i]
    const right = b.folders[i]
    if (
      left.name !== right.name ||
      left.path !== right.path ||
      left.size !== right.size
    ) {
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
    log.warn('Backed up corrupt snapshot file', backupPath)
  } catch (backupErr) {
    log.warn('Failed to back up corrupt snapshot file', backupErr)
  }
}

function getTempSnapshotFile(filePath: string): string {
  return `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
}
