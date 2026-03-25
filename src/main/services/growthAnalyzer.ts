import * as fs from 'fs/promises'
import * as path from 'path'
import { homedir, platform } from 'os'
import type { GrowthFolder, GrowthViewResult } from '@shared/types'
import { saveSnapshot, getSnapshotsInRange, loadSnapshots, type Snapshot, type FolderSnapshot } from './snapshotStore'
import { logError, logInfo } from './logging'
import { getDirSize } from '../utils/getDirSize'
import { tk } from '../i18n'

const PERIODS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
}

function getTargetFolders(home: string): { name: string; path: string }[] {
  if (platform() === 'darwin') {
    return ['Documents', 'Downloads', 'Desktop', 'Pictures', 'Movies', 'Music', 'Developer', 'Library']
      .map((name) => ({ name, path: path.join(home, name) }))
  }

  // Windows: AppData 하위를 직접 지정하여 전체 스캔 방지
  const appData = path.join(home, 'AppData')
  return [
    ...['Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos', 'Music']
      .map((name) => ({ name, path: path.join(home, name) })),
    { name: 'AppData/Local', path: path.join(appData, 'Local') },
    { name: 'AppData/Roaming', path: path.join(appData, 'Roaming') }
  ]
}

// 동시 실행 방지
let snapshotInProgress: Promise<Snapshot> | null = null

// 현재 폴더 크기를 측정하고 스냅샷 저장
export function takeSnapshot(): Promise<Snapshot> {
  // 이미 진행 중이면 같은 Promise 반환 (중복 실행 방지)
  if (snapshotInProgress) return snapshotInProgress

  snapshotInProgress = doTakeSnapshot().finally(() => {
    snapshotInProgress = null
  })
  return snapshotInProgress
}

async function doTakeSnapshot(): Promise<Snapshot> {
  const home = homedir()
  const targets = getTargetFolders(home)

  const FOLDER_TIMEOUT = 30_000
  const results = await Promise.all(targets.map(async (target) => {
    try {
      await fs.access(target.path)
      const size = await withTimeout(getDirSize(target.path), FOLDER_TIMEOUT, 'timeout')
      return { name: target.name, path: target.path, size }
    } catch {
      return null
    }
  }))
  const folders: FolderSnapshot[] = results.filter((r): r is FolderSnapshot => r !== null)

  const snapshot: Snapshot = {
    timestamp: Date.now(),
    folders,
    totalSize: folders.reduce((acc, f) => acc + f.size, 0)
  }

  await saveSnapshot(snapshot)
  logInfo('snapshot', 'Snapshot saved', { folderCount: folders.length, totalSize: snapshot.totalSize })
  return snapshot
}

// 스냅샷 비교로 실제 증감 계산
export async function analyzeGrowth(period: string = '7d'): Promise<GrowthViewResult> {
  const ms = PERIODS[period] ?? PERIODS['7d']
  const since = Date.now() - ms

  // 최근 스냅샷이 5분 이내이면 재사용, 아니면 새로 찍기
  const allSnapshots = getSnapshotsInRange(0)
  const latest = allSnapshots[allSnapshots.length - 1]
  const current = (latest && Date.now() - latest.timestamp < 5 * 60 * 1000)
    ? latest
    : await takeSnapshot()

  const baseline = findBaselineSnapshot(loadSnapshots(), since)

  if (!baseline || baseline.timestamp === current.timestamp) {
    // 과거 데이터가 없음 → 첫 실행이거나 기간 내 스냅샷 없음
    return {
      period,
      cutoffMs: since,
      folders: current.folders.map((f) => ({
        name: f.name,
        path: f.path,
        addedSize: 0,
        addedFiles: 0,
        totalSize: f.size,
        growthRate: 0
      })),
      totalAdded: 0,
      totalAddedFiles: 0
    }
  }

  // 폴더별 증감 계산
  const oldMap = new Map(baseline.folders.map((f) => [f.name, f.size]))
  const folders: GrowthFolder[] = []

  for (const cur of current.folders) {
    const oldSize = oldMap.get(cur.name) ?? 0
    const diff = cur.size - oldSize

    folders.push({
      name: cur.name,
      path: cur.path,
      addedSize: Math.max(diff, 0),   // 증가만 표시 (감소는 0)
      addedFiles: 0,                  // 스냅샷 방식에서는 파일 수 추적 안 함
      totalSize: cur.size,
      growthRate: cur.size > 0 ? Math.max(diff, 0) / cur.size : 0
    })
  }

  folders.sort((a, b) => b.addedSize - a.addedSize)

  return {
    period,
    cutoffMs: since,
    folders,
    totalAdded: folders.reduce((acc, f) => acc + f.addedSize, 0),
    totalAddedFiles: 0
  }
}

function findBaselineSnapshot(snapshots: Snapshot[], since: number): Snapshot | null {
  if (snapshots.length === 0) {
    return null
  }

  let latestBeforeOrAtCutoff: Snapshot | null = null
  let earliestAfterCutoff: Snapshot | null = null

  for (const snapshot of snapshots) {
    if (snapshot.timestamp <= since) {
      latestBeforeOrAtCutoff = snapshot
      continue
    }

    if (!earliestAfterCutoff) {
      earliestAfterCutoff = snapshot
    }
  }

  return latestBeforeOrAtCutoff ?? earliestAfterCutoff
}

// 주기적 스냅샷 스케줄러
let snapshotInterval: ReturnType<typeof setInterval> | null = null

export function startSnapshotScheduler(intervalMs: number = 60 * 60 * 1000): void {
  if (snapshotInterval) return

  // 앱 시작 시 즉시 1회 스냅샷
  takeSnapshot().catch((err) => logError('snapshot', 'Initial snapshot failed', err))

  // 이후 설정된 주기마다
  snapshotInterval = setInterval(() => {
    takeSnapshot().catch((err) => logError('snapshot', 'Scheduled snapshot failed', err))
  }, intervalMs)
}

export function stopSnapshotScheduler(): void {
  if (snapshotInterval) {
    clearInterval(snapshotInterval)
    snapshotInterval = null
  }
}

export async function waitForPendingSnapshot(timeoutMs: number = 5000): Promise<boolean> {
  if (!snapshotInProgress) {
    return true
  }

  try {
    await withTimeout(snapshotInProgress, timeoutMs, tk('growth.wait_timeout'))
    return true
  } catch {
    return false
  }
}

export function restartSnapshotScheduler(intervalMs: number): void {
  stopSnapshotScheduler()
  startSnapshotScheduler(intervalMs)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}
