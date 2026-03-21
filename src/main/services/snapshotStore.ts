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
  const dir = getSnapshotDir()
  const filePath = getSnapshotFile()

  // 매 저장 시 디렉토리 존재 보장
  await fsp.mkdir(dir, { recursive: true })

  const existing = loadSnapshots()
  existing.push(snapshot)

  // 오래된 스냅샷 정리
  while (existing.length > MAX_SNAPSHOTS) {
    existing.shift()
  }

  const data: SnapshotData = { version: 1, snapshots: existing }

  // atomic write 대신 직접 쓰기 (같은 디렉토리 내 rename 실패 방지)
  try {
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    log.error('Failed to save snapshot', err)
  }
}

export function getSnapshotsInRange(since: number): Snapshot[] {
  return loadSnapshots().filter((s) => s.timestamp >= since)
}
