import type {
  DockerActionResult,
  DockerBuildCacheScanResult,
  DockerBuildCacheSummary,
  DockerContainersScanResult,
  DockerContainerSummary,
  DockerImagesScanResult,
  DockerImageSummary,
  DockerPruneResult,
  DockerRemoveResult,
  DockerVolumesScanResult,
  DockerVolumeSummary
} from '@shared/types'
import { logInfo, logWarn } from './logging'
import { tk } from '../i18n'
import { isExternalCommandError, runExternalCommand } from './externalCommand'

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
    message: images.length === 0 ? tk('main.docker.images.empty') : null
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
      logWarn('docker-images', 'Skipping invalid Docker image ID', { imageId })
      errors.push(tk('main.docker.images.invalid_id', { id: imageId }))
      continue
    }
    try {
      await runDockerCommand(['image', 'rm', imageId])
      deletedIds.push(imageId)
    } catch (error) {
      logWarn('docker-images', 'Failed to remove Docker image', { imageId, error })
      errors.push(normalizeDockerError(error, tk('main.docker.images.delete_failed', { id: imageId })))
    }
  }

  logInfo('docker-images', 'Docker image removal completed', {
    requestedCount: imageIds.length,
    deletedCount: deletedIds.length,
    failCount: imageIds.length - deletedIds.length
  })

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
    message: containers.length === 0 ? tk('main.docker.containers.empty') : null
  }
}

export async function removeDockerContainers(containerIds: string[]): Promise<DockerRemoveResult> {
  const deletedIds: string[] = []
  const errors: string[] = []

  for (const containerId of containerIds) {
    if (!validateDockerId(containerId)) {
      logWarn('docker-containers', 'Skipping invalid Docker container ID', { containerId })
      errors.push(tk('main.docker.containers.invalid_id', { id: containerId }))
      continue
    }
    try {
      await runDockerCommand(['rm', containerId])
      deletedIds.push(containerId)
    } catch (error) {
      logWarn('docker-containers', 'Failed to remove Docker container', { containerId, error })
      errors.push(normalizeDockerError(error, tk('main.docker.containers.delete_failed', { id: containerId })))
    }
  }

  logInfo('docker-containers', 'Docker container removal completed', {
    requestedCount: containerIds.length,
    deletedCount: deletedIds.length,
    failCount: containerIds.length - deletedIds.length
  })

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
      logWarn('docker-containers', 'Skipping invalid Docker container ID', { containerId })
      errors.push(tk('main.docker.containers.invalid_id', { id: containerId }))
      continue
    }
    try {
      await runDockerCommand(['stop', containerId])
      affectedIds.push(containerId)
    } catch (error) {
      logWarn('docker-containers', 'Failed to stop Docker container', { containerId, error })
      errors.push(normalizeDockerError(error, tk('main.docker.containers.stop_failed', { id: containerId })))
    }
  }

  logInfo('docker-containers', 'Docker container stop completed', {
    requestedCount: containerIds.length,
    affectedCount: affectedIds.length,
    failCount: containerIds.length - affectedIds.length
  })

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
    message: volumes.length === 0 ? tk('main.docker.volumes.empty') : null
  }
}

export async function removeDockerVolumes(volumeNames: string[]): Promise<DockerRemoveResult> {
  const deletedIds: string[] = []
  const errors: string[] = []

  for (const volumeName of volumeNames) {
    if (!validateDockerId(volumeName)) {
      logWarn('docker-volumes', 'Skipping invalid Docker volume name', { volumeName })
      errors.push(tk('main.docker.volumes.invalid_name', { name: volumeName }))
      continue
    }
    try {
      await runDockerCommand(['volume', 'rm', volumeName])
      deletedIds.push(volumeName)
    } catch (error) {
      logWarn('docker-volumes', 'Failed to remove Docker volume', { volumeName, error })
      errors.push(normalizeDockerError(error, tk('main.docker.volumes.delete_failed', { name: volumeName })))
    }
  }

  logInfo('docker-volumes', 'Docker volume removal completed', {
    requestedCount: volumeNames.length,
    deletedCount: deletedIds.length,
    failCount: volumeNames.length - deletedIds.length
  })

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
    message: summary.totalCount === 0 ? tk('main.docker.build_cache.empty') : null
  }
}

export async function pruneDockerBuildCache(): Promise<DockerPruneResult> {
  const { stdout } = await runDockerCommand(['builder', 'prune', '--force'])
  const reclaimedLabel = parseReclaimedLabel(stdout)
  logInfo('docker-build-cache', 'Docker build cache prune completed', { reclaimedLabel: normalizeByteLabel(reclaimedLabel) })
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
        // Docker 출력에서 잘못된 형식의 JSON 줄 건너뜀
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
  return runExternalCommand('docker', args)
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
  if (isExternalCommandError(error) && error.kind === 'command_not_found') {
    return 'not_installed'
  }

  const message = normalizeDockerError(error, '').toLowerCase()
  if (message.includes('enoent') || message.includes('not found') || message.includes('is not recognized')) {
    return 'not_installed'
  }
  return 'daemon_unavailable'
}

function getDockerStatusMessage(status: 'not_installed' | 'daemon_unavailable'): string {
  if (status === 'not_installed') {
    return tk('main.docker.status.not_installed')
  }

  return tk('main.docker.status.daemon_unavailable')
}

function normalizeDockerError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { stderr?: string; message?: string }
    const message = err.stderr?.trim() || err.message?.trim()
    if (message) return message
  }
  return fallback
}
