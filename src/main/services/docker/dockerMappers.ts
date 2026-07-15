import type { DockerBuildCacheSummary, DockerContainerSummary, DockerImageSummary, DockerVolumeSummary } from '@shared/types'

export interface DockerImageRow {
  ID?: string
  Repository?: string
  Tag?: string
  Size?: string
  CreatedSince?: string
}

export interface DockerContainerRow {
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

export interface DockerVolumeRow {
  Name?: string
  Driver?: string
  Mountpoint?: string
}

export interface DockerSystemDfRow {
  Type?: string
  TotalCount?: string
  Active?: string
  Size?: string
  Reclaimable?: string
}


export function toDockerImageSummary(row: DockerImageRow, containersByImageId: Map<string, string[]>): DockerImageSummary | null {
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

export function toDockerContainerSummary(row: DockerContainerRow): DockerContainerSummary | null {
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

export function toDockerVolumeSummary(
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

export function toDockerBuildCacheSummary(row: DockerSystemDfRow): DockerBuildCacheSummary {
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

export function parseDockerSize(size: string | undefined): number {
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

export function normalizeReclaimableLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return '0 B'
  const primary = trimmed.split('(')[0]?.trim() ?? trimmed
  return normalizeByteLabel(primary)
}

export function normalizeByteLabel(label: string): string {
  const trimmed = label.replace(/,/g, '').trim()
  if (/^\d+(\.\d+)?[KMGTP]?B$/i.test(trimmed)) {
    return trimmed.replace(/([0-9.])([A-Za-z])/, '$1 $2')
  }
  return trimmed || '0 B'
}

export function parseReclaimedLabel(stdout: string): string {
  const match = stdout.match(/Total reclaimed space:\s*([^\n]+)/i)
  return normalizeByteLabel(match?.[1]?.trim() ?? '0 B')
}

