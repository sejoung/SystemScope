import * as fs from 'fs/promises'
import * as path from 'path'
import { homedir, platform } from 'os'
import type { GrowthFolder, GrowthViewResult } from '@shared/types'
import { saveSnapshot, getSnapshotsInRange, type Snapshot, type FolderSnapshot } from './snapshotStore'
import { logError, logInfo } from './logging'
import { getDirSize } from '../utils/getDirSize'

const PERIODS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
}

function getTargetFolders(home: string): { name: string; path: string }[] {
  const names = platform() === 'darwin'
    ? ['Documents', 'Downloads', 'Desktop', 'Pictures', 'Movies', 'Music', 'Developer', 'Library']
    : ['Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos', 'Music', 'AppData']
  return names.map((name) => ({ name, path: path.join(home, name) }))
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

  const folders: FolderSnapshot[] = []
  for (const target of targets) {
    try {
      await fs.access(target.path)
      const size = await getDirSize(target.path)
      folders.push({ name: target.name, path: target.path, size })
    } catch {
      // 존재하지 않는 폴더
    }
  }

  const snapshot: Snapshot = {
    timestamp: Date.now(),
    folders,
    totalSize: folders.reduce((acc, f) => acc + f.size, 0)
  }

  await saveSnapshot(snapshot)
  logInfo('snapshot', '스냅샷 저장 완료', { folderCount: folders.length, totalSize: snapshot.totalSize })
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

  // 해당 기간 내 가장 오래된 스냅샷 찾기
  const history = getSnapshotsInRange(since)
  const oldest = history.length > 0 ? history[0] : null

  if (!oldest || oldest.timestamp === current.timestamp) {
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
  const oldMap = new Map(oldest.folders.map((f) => [f.name, f.size]))
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

// 주기적 스냅샷 스케줄러
let snapshotInterval: ReturnType<typeof setInterval> | null = null

export function startSnapshotScheduler(intervalMs: number = 60 * 60 * 1000): void {
  if (snapshotInterval) return

  // 앱 시작 시 즉시 1회 스냅샷
  takeSnapshot().catch((err) => logError('snapshot', '초기 스냅샷 실패', err))

  // 이후 설정된 주기마다
  snapshotInterval = setInterval(() => {
    takeSnapshot().catch((err) => logError('snapshot', '예약된 스냅샷 실패', err))
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
    await Promise.race([
      snapshotInProgress,
      new Promise((_, reject) => setTimeout(() => reject(new Error('스냅샷 대기 시간 초과')), timeoutMs))
    ])
    return true
  } catch {
    return false
  }
}

export function restartSnapshotScheduler(intervalMs: number): void {
  stopSnapshotScheduler()
  startSnapshotScheduler(intervalMs)
}
