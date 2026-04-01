import { randomUUID } from 'node:crypto'
import { PersistentStore } from './persistentStore'
import { getSessionSnapshotsFilePath } from './dataDir'
import { getSystemStats } from './systemMonitor'
import { getTopCpuProcesses, getTopMemoryProcesses } from './processMonitor'
import { getActiveAlerts } from './alertManager'
import { listDockerImages, listDockerContainers, listDockerVolumes } from './dockerImages'
import { logInfo } from './logging'
import type { SessionSnapshot, SnapshotDiff, SnapshotDiffDelta } from '@shared/types'

const SCHEMA_VERSION = 1
const MAX_SNAPSHOTS = 50
const MS_PER_DAY = 24 * 60 * 60 * 1000
const RETENTION_DAYS = 90

let store: PersistentStore<SessionSnapshot> | null = null

function getStore(): PersistentStore<SessionSnapshot> {
  if (!store) {
    store = new PersistentStore<SessionSnapshot>({
      filePath: getSessionSnapshotsFilePath(),
      schemaVersion: SCHEMA_VERSION,
      maxEntries: MAX_SNAPSHOTS,
      maxAgeMs: RETENTION_DAYS * MS_PER_DAY,
      getTimestamp: (entry) => entry.timestamp,
    })
  }
  return store
}

export async function saveSessionSnapshot(label?: string): Promise<SessionSnapshot> {
  const stats = await getSystemStats()
  const cpuTop = await getTopCpuProcesses(10)
  const memTop = await getTopMemoryProcesses(10)
  const alerts = getActiveAlerts()

  const topProcesses = [...cpuTop, ...memTop]
    .filter((p, i, arr) => arr.findIndex((x) => x.pid === p.pid) === i)
    .slice(0, 10)
    .map((p) => ({ name: p.name, pid: p.pid, cpu: p.cpu, memory: p.memory }))

  let docker: SessionSnapshot['docker'] = null
  try {
    const images = await listDockerImages()
    const containers = await listDockerContainers()
    const volumes = await listDockerVolumes()
    const imagesTotalSize = images.images.reduce((sum, img) => sum + img.sizeBytes, 0)
    docker = {
      imagesCount: images.images.length,
      containersCount: containers.containers.length,
      volumesCount: volumes.volumes.length,
      totalSize: imagesTotalSize,
    }
  } catch {
    // Docker not available
  }

  const primaryDrive = stats.disk.drives[0]

  const snapshot: SessionSnapshot = {
    id: randomUUID(),
    label: (label ? label.slice(0, 100).trim() : '') || `Snapshot ${new Date().toLocaleString()}`,
    timestamp: Date.now(),
    system: {
      cpuUsage: stats.cpu.usage,
      memoryUsage: stats.memory.usage,
      memoryTotal: stats.memory.total,
      diskUsage: primaryDrive?.usage ?? 0,
      diskTotal: primaryDrive?.size ?? 0,
      gpuUsage: stats.gpu.usage,
      networkRxSec: stats.network.downloadBytesPerSecond ?? 0,
      networkTxSec: stats.network.uploadBytesPerSecond ?? 0,
    },
    topProcesses,
    activeAlerts: alerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message })),
    docker,
  }

  await getStore().append(snapshot)
  logInfo('session-snapshot', 'Snapshot saved', { id: snapshot.id, label: snapshot.label })

  return snapshot
}

export async function getSessionSnapshots(): Promise<SessionSnapshot[]> {
  const entries = await getStore().load()
  return [...entries].sort((a, b) => b.timestamp - a.timestamp)
}

export async function deleteSessionSnapshot(id: string): Promise<boolean> {
  const s = getStore()
  const entries = await s.load()
  const filtered = entries.filter((e) => e.id !== id)
  if (filtered.length === entries.length) return false

  await s.clear()
  if (filtered.length > 0) {
    await s.appendBatch(filtered)
  }
  logInfo('session-snapshot', 'Snapshot deleted', { id })
  return true
}

function makeDelta(before: number, after: number): SnapshotDiffDelta {
  return { before, after, delta: after - before }
}

export function computeSnapshotDiff(snap1: SessionSnapshot, snap2: SessionSnapshot): SnapshotDiff {
  const s1 = snap1.system
  const s2 = snap2.system

  const system: Record<string, SnapshotDiffDelta> = {
    cpuUsage: makeDelta(s1.cpuUsage, s2.cpuUsage),
    memoryUsage: makeDelta(s1.memoryUsage, s2.memoryUsage),
    memoryTotal: makeDelta(s1.memoryTotal, s2.memoryTotal),
    diskUsage: makeDelta(s1.diskUsage, s2.diskUsage),
    diskTotal: makeDelta(s1.diskTotal, s2.diskTotal),
    networkRxSec: makeDelta(s1.networkRxSec, s2.networkRxSec),
    networkTxSec: makeDelta(s1.networkTxSec, s2.networkTxSec),
  }

  const names1 = new Set(snap1.topProcesses.map((p) => p.name))
  const names2 = new Set(snap2.topProcesses.map((p) => p.name))
  const added = [...names2].filter((n) => !names1.has(n))
  const removed = [...names1].filter((n) => !names2.has(n))
  const changed: { name: string; cpuDelta: number; memoryDelta: number }[] = []

  for (const name of names1) {
    if (!names2.has(name)) continue
    const p1 = snap1.topProcesses.find((p) => p.name === name)!
    const p2 = snap2.topProcesses.find((p) => p.name === name)!
    const cpuDelta = p2.cpu - p1.cpu
    const memoryDelta = p2.memory - p1.memory
    if (Math.abs(cpuDelta) > 0.1 || Math.abs(memoryDelta) > 0.1) {
      changed.push({ name, cpuDelta, memoryDelta })
    }
  }

  const alertTypes1 = new Set(snap1.activeAlerts.map((a) => a.type))
  const alertTypes2 = new Set(snap2.activeAlerts.map((a) => a.type))
  const alertsAdded = [...alertTypes2].filter((t) => !alertTypes1.has(t))
  const alertsRemoved = [...alertTypes1].filter((t) => !alertTypes2.has(t))

  let dockerDelta: Record<string, SnapshotDiffDelta> | null = null
  if (snap1.docker && snap2.docker) {
    dockerDelta = {
      imagesCount: makeDelta(snap1.docker.imagesCount, snap2.docker.imagesCount),
      containersCount: makeDelta(snap1.docker.containersCount, snap2.docker.containersCount),
      volumesCount: makeDelta(snap1.docker.volumesCount, snap2.docker.volumesCount),
      totalSize: makeDelta(snap1.docker.totalSize, snap2.docker.totalSize),
    }
  }

  return {
    snapshot1: { id: snap1.id, label: snap1.label, timestamp: snap1.timestamp },
    snapshot2: { id: snap2.id, label: snap2.label, timestamp: snap2.timestamp },
    system,
    processChanges: { added, removed, changed },
    alertChanges: { added: alertsAdded, removed: alertsRemoved },
    dockerDelta,
  }
}

export async function getSessionSnapshotDiff(id1: string, id2: string): Promise<SnapshotDiff | null> {
  const entries = await getStore().load()
  const snap1 = entries.find((e) => e.id === id1)
  const snap2 = entries.find((e) => e.id === id2)
  if (!snap1 || !snap2) return null

  return computeSnapshotDiff(snap1, snap2)
}
