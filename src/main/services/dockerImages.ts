import { execFile } from 'child_process'
import log from 'electron-log'
import type {
  DockerActionResult,
  DockerBuildCacheScanResult,
  DockerBuildCacheSummary,
  DockerContainersScanResult,
  DockerContainerSummary,
  DockerImagesScanResult,
  DockerImageSummary,
  DockerPruneResult,
  DockerRemoveResult
  ,
  DockerVolumesScanResult,
  DockerVolumeSummary
} from '@shared/types'

interface DockerImageRow {
  ID?: string
  Repository?: string
  Tag?: string
  Size?: string
  CreatedSince?: string
}

interface DockerContainerRow {
  ID?: string
  ImageID?: string
  Image?: string
  Command?: string
  Status?: string
  Names?: string
  Ports?: string
  Size?: string
  Mounts?: string
}

interface DockerVolumeRow {
  Name?: string
  Driver?: string
  Mountpoint?: string
}

interface DockerSystemDfRow {
  Type?: string
  TotalCount?: string
  Active?: string
  Size?: string
  Reclaimable?: string
}

export async function listDockerImages(): Promise<DockerImagesScanResult> {
  const imageResult = await runDockerJsonLines<DockerImageRow>(['image', 'ls', '--all', '--no-trunc', '--format', '{{json .}}'])
  if (imageResult.status !== 'ready') {
    return {
      status: imageResult.status,
      images: [],
      message: imageResult.message
    }
  }

  const containerResult = await runDockerJsonLines<DockerContainerRow>(['ps', '-a', '--no-trunc', '--format', '{{json .}}'])
  const containersByImageId = new Map<string, string[]>()
  if (containerResult.status === 'ready') {
    for (const container of containerResult.rows) {
      const imageId = String(container.ImageID ?? '').trim()
      if (!imageId) continue
      const names = containersByImageId.get(imageId) ?? []
      if (container.Names) names.push(container.Names)
      containersByImageId.set(imageId, names)
    }
  }

  const images = imageResult.rows
    .map((row) => toDockerImageSummary(row, containersByImageId))
    .filter((image): image is DockerImageSummary => image !== null)
    .sort((a, b) => b.sizeBytes - a.sizeBytes)

  return {
    status: 'ready',
    images,
    message: images.length === 0 ? 'Docker 이미지가 없습니다.' : null
  }
}

// Docker ID/이름 검증: 영숫자, :, ., -, _, / 만 허용
const DOCKER_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:\-/]*$/

function validateDockerId(id: string): boolean {
  return DOCKER_ID_PATTERN.test(id)
}

export async function removeDockerImages(imageIds: string[]): Promise<DockerRemoveResult> {
  const deletedIds: string[] = []
  const errors: string[] = []

  for (const imageId of imageIds) {
    if (!validateDockerId(imageId)) {
      log.warn('Invalid Docker image ID skipped', { imageId })
      errors.push(`이미지 ${imageId}: 유효하지 않은 ID`)
      continue
    }
    try {
      await runDockerCommand(['image', 'rm', imageId])
      deletedIds.push(imageId)
    } catch (error) {
      errors.push(normalizeDockerError(error, `이미지 ${imageId} 삭제 실패`))
    }
  }

  return {
    deletedIds,
    failCount: imageIds.length - deletedIds.length,
    errors,
    cancelled: false
  }
}

export async function listDockerContainers(): Promise<DockerContainersScanResult> {
  const containerResult = await runDockerJsonLines<DockerContainerRow>([
    'ps',
    '-a',
    '--size',
    '--no-trunc',
    '--format',
    '{{json .}}'
  ])

  if (containerResult.status !== 'ready') {
    return {
      status: containerResult.status,
      containers: [],
      message: containerResult.message
    }
  }

  const containers = containerResult.rows
    .map((row) => toDockerContainerSummary(row))
    .filter((container): container is DockerContainerSummary => container !== null)
    .sort((a, b) => {
      if (a.running !== b.running) return a.running ? -1 : 1
      return b.sizeBytes - a.sizeBytes
    })

  return {
    status: 'ready',
    containers,
    message: containers.length === 0 ? '정리할 Docker 컨테이너가 없습니다.' : null
  }
}

export async function removeDockerContainers(containerIds: string[]): Promise<DockerRemoveResult> {
  const deletedIds: string[] = []
  const errors: string[] = []

  for (const containerId of containerIds) {
    if (!validateDockerId(containerId)) {
      log.warn('Invalid Docker container ID skipped', { containerId })
      errors.push(`컨테이너 ${containerId}: 유효하지 않은 ID`)
      continue
    }
    try {
      await runDockerCommand(['rm', containerId])
      deletedIds.push(containerId)
    } catch (error) {
      errors.push(normalizeDockerError(error, `컨테이너 ${containerId} 삭제 실패`))
    }
  }

  return {
    deletedIds,
    failCount: containerIds.length - deletedIds.length,
    errors,
    cancelled: false
  }
}

export async function stopDockerContainers(containerIds: string[]): Promise<DockerActionResult> {
  const affectedIds: string[] = []
  const errors: string[] = []

  for (const containerId of containerIds) {
    if (!validateDockerId(containerId)) {
      log.warn('Invalid Docker container ID skipped', { containerId })
      errors.push(`컨테이너 ${containerId}: 유효하지 않은 ID`)
      continue
    }
    try {
      await runDockerCommand(['stop', containerId])
      affectedIds.push(containerId)
    } catch (error) {
      errors.push(normalizeDockerError(error, `컨테이너 ${containerId} 중지 실패`))
    }
  }

  return {
    affectedIds,
    failCount: containerIds.length - affectedIds.length,
    errors,
    cancelled: false
  }
}

export async function listDockerVolumes(): Promise<DockerVolumesScanResult> {
  const volumeResult = await runDockerJsonLines<DockerVolumeRow>(['volume', 'ls', '--format', '{{json .}}'])
  if (volumeResult.status !== 'ready') {
    return {
      status: volumeResult.status,
      volumes: [],
      message: volumeResult.message
    }
  }

  const containerResult = await runDockerJsonLines<DockerContainerRow>([
    'ps',
    '-a',
    '--format',
    '{{json .}}'
  ])
  const containersByVolume = new Map<string, string[]>()
  if (containerResult.status === 'ready') {
    for (const container of containerResult.rows) {
      const mounts = String(container.Mounts ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
      for (const mount of mounts) {
        const containers = containersByVolume.get(mount) ?? []
        if (container.Names) containers.push(container.Names)
        containersByVolume.set(mount, containers)
      }
    }
  }

  const volumes = volumeResult.rows
    .map((row) => toDockerVolumeSummary(row, containersByVolume))
    .filter((volume): volume is DockerVolumeSummary => volume !== null)
    .sort((a, b) => Number(a.inUse) - Number(b.inUse) || a.name.localeCompare(b.name))

  return {
    status: 'ready',
    volumes,
    message: volumes.length === 0 ? 'Docker 볼륨이 없습니다.' : null
  }
}

export async function removeDockerVolumes(volumeNames: string[]): Promise<DockerRemoveResult> {
  const deletedIds: string[] = []
  const errors: string[] = []

  for (const volumeName of volumeNames) {
    if (!validateDockerId(volumeName)) {
      log.warn('Invalid Docker volume name skipped', { volumeName })
      errors.push(`볼륨 ${volumeName}: 유효하지 않은 이름`)
      continue
    }
    try {
      await runDockerCommand(['volume', 'rm', volumeName])
      deletedIds.push(volumeName)
    } catch (error) {
      errors.push(normalizeDockerError(error, `볼륨 ${volumeName} 삭제 실패`))
    }
  }

  return {
    deletedIds,
    failCount: volumeNames.length - deletedIds.length,
    errors,
    cancelled: false
  }
}

export async function getDockerBuildCache(): Promise<DockerBuildCacheScanResult> {
  const dfResult = await runDockerJsonLines<DockerSystemDfRow>(['system', 'df', '--format', '{{json .}}'])
  if (dfResult.status !== 'ready') {
    return {
      status: dfResult.status,
      summary: null,
      message: dfResult.message
    }
  }

  const row = dfResult.rows.find((entry) => String(entry.Type ?? '').toLowerCase() === 'build cache')
  const summary = row ? toDockerBuildCacheSummary(row) : {
    totalCount: 0,
    activeCount: 0,
    sizeBytes: 0,
    sizeLabel: '0 B',
    reclaimableBytes: 0,
    reclaimableLabel: '0 B'
  }

  return {
    status: 'ready',
    summary,
    message: summary.totalCount === 0 ? '정리할 Docker build cache가 없습니다.' : null
  }
}

export async function pruneDockerBuildCache(): Promise<DockerPruneResult> {
  const { stdout } = await runDockerCommand(['builder', 'prune', '--force'])
  const reclaimedLabel = parseReclaimedLabel(stdout)
  return {
    reclaimedBytes: parseDockerSize(reclaimedLabel),
    reclaimedLabel: normalizeByteLabel(reclaimedLabel),
    cancelled: false
  }
}

async function runDockerJsonLines<T>(args: string[]): Promise<
  | { status: 'ready'; rows: T[]; message: null }
  | { status: 'not_installed' | 'daemon_unavailable'; rows: T[]; message: string }
> {
  try {
    const { stdout } = await runDockerCommand(args)
    const rows: T[] = []
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        rows.push(JSON.parse(trimmed) as T)
      } catch {
        // skip malformed JSON lines from Docker output
      }
    }

    return {
      status: 'ready',
      rows,
      message: null
    }
  } catch (error) {
    const status = detectDockerStatus(error)
    return {
      status,
      rows: [],
      message: getDockerStatusMessage(status)
    }
  }
}

function runDockerCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('docker', args, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }))
        return
      }

      resolve({
        stdout: stdout ?? '',
        stderr: stderr ?? ''
      })
    })
  })
}

function toDockerImageSummary(row: DockerImageRow, containersByImageId: Map<string, string[]>): DockerImageSummary | null {
  const id = String(row.ID ?? '').trim()
  if (!id) return null

  const repository = String(row.Repository ?? '<none>')
  const tag = String(row.Tag ?? '<none>')
  const containers = containersByImageId.get(id) ?? []

  return {
    id,
    shortId: id.startsWith('sha256:') ? id.slice(7, 19) : id.slice(0, 12),
    repository,
    tag,
    sizeBytes: parseDockerSize(row.Size),
    sizeLabel: String(row.Size ?? '-'),
    createdSince: String(row.CreatedSince ?? '-'),
    inUse: containers.length > 0,
    dangling: repository === '<none>' || tag === '<none>',
    containers
  }
}

function toDockerContainerSummary(row: DockerContainerRow): DockerContainerSummary | null {
  const id = String(row.ID ?? '').trim()
  if (!id) return null

  const status = String(row.Status ?? '').trim()
  const sizeLabel = String(row.Size ?? '0B').trim()

  return {
    id,
    shortId: id.slice(0, 12),
    name: String(row.Names ?? '-'),
    image: String(row.Image ?? '-'),
    command: String(row.Command ?? '').trim(),
    status: status || '-',
    ports: String(row.Ports ?? '').trim(),
    sizeBytes: parseDockerSize(sizeLabel),
    running: /^up\b/i.test(status)
  }
}

function toDockerVolumeSummary(
  row: DockerVolumeRow,
  containersByVolume: Map<string, string[]>
): DockerVolumeSummary | null {
  const name = String(row.Name ?? '').trim()
  if (!name) return null
  const containers = containersByVolume.get(name) ?? []

  return {
    name,
    driver: String(row.Driver ?? '-'),
    mountpoint: String(row.Mountpoint ?? '-'),
    inUse: containers.length > 0,
    containers
  }
}

function toDockerBuildCacheSummary(row: DockerSystemDfRow): DockerBuildCacheSummary {
  const totalCount = Number.parseInt(String(row.TotalCount ?? '0'), 10) || 0
  const activeCount = Number.parseInt(String(row.Active ?? '0'), 10) || 0
  const sizeLabel = normalizeByteLabel(String(row.Size ?? '0 B'))
  const reclaimableLabel = normalizeReclaimableLabel(String(row.Reclaimable ?? '0 B'))

  return {
    totalCount,
    activeCount,
    sizeBytes: parseDockerSize(sizeLabel),
    sizeLabel,
    reclaimableBytes: parseDockerSize(reclaimableLabel),
    reclaimableLabel
  }
}

function parseDockerSize(size: string | undefined): number {
  if (!size) return 0
  const normalized = size.replace(/,/g, '').trim()
  const primary = normalized.includes('(') ? normalized.slice(0, normalized.indexOf('(')).trim() : normalized
  const match = primary.match(/^([\d.]+)\s*([KMGTP]?B)$/i)
  if (!match) return 0

  const value = Number(match[1])
  const unit = match[2].toUpperCase()
  const multiplier: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
    PB: 1024 ** 5
  }

  return Math.round(value * (multiplier[unit] ?? 1))
}

function normalizeReclaimableLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return '0 B'
  const primary = trimmed.split('(')[0]?.trim() ?? trimmed
  return normalizeByteLabel(primary)
}

function normalizeByteLabel(label: string): string {
  const trimmed = label.replace(/,/g, '').trim()
  if (/^\d+(\.\d+)?[KMGTP]?B$/i.test(trimmed)) {
    return trimmed.replace(/([0-9.])([A-Za-z])/, '$1 $2')
  }
  return trimmed || '0 B'
}

function parseReclaimedLabel(stdout: string): string {
  const match = stdout.match(/Total reclaimed space:\s*([^\n]+)/i)
  return normalizeByteLabel(match?.[1]?.trim() ?? '0 B')
}

function detectDockerStatus(error: unknown): 'not_installed' | 'daemon_unavailable' {
  const message = normalizeDockerError(error, '').toLowerCase()
  if (message.includes('enoent') || message.includes('not found') || message.includes('is not recognized')) {
    return 'not_installed'
  }
  return 'daemon_unavailable'
}

function getDockerStatusMessage(status: 'not_installed' | 'daemon_unavailable'): string {
  if (status === 'not_installed') {
    return 'Docker가 설치되어 있지 않습니다. Docker Desktop 또는 Docker Engine을 설치한 뒤 다시 시도하세요.'
  }

  return 'Docker는 설치되어 있지만 현재 실행 중이 아닙니다. Docker Desktop 또는 Docker Engine을 시작한 뒤 다시 시도하세요.'
}

function normalizeDockerError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { stderr?: string; message?: string }
    const message = err.stderr?.trim() || err.message?.trim()
    if (message) return message
  }
  return fallback
}
