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
    const data: SnapshotData = JSON.parse(raw)
    if (data.version !== 1 || !Array.isArray(data.snapshots)) return []
    return data.snapshots
  } catch (err) {
    log.warn('Failed to load snapshots, starting fresh', err)
    return []
  }
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  ensureSnapshotDir()
  const filePath = getSnapshotFile()

  const existing = loadSnapshots()
  existing.push(snapshot)

  // 오래된 스냅샷 정리
  while (existing.length > MAX_SNAPSHOTS) {
    existing.shift()
  }

  const data: SnapshotData = { version: 1, snapshots: existing }

  // atomic write: 임시 파일에 쓰고 rename
  const tmpPath = filePath + '.tmp'
  try {
    await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    await fsp.rename(tmpPath, filePath)
  } catch (err) {
    log.error('Failed to save snapshot', err)
    // 임시 파일 정리
    try { await fsp.unlink(tmpPath) } catch { /* ignore */ }
  }
}

export function getSnapshotsInRange(since: number): Snapshot[] {
  return loadSnapshots().filter((s) => s.timestamp >= since)
}
