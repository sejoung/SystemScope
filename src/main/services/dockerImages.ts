import { execFile } from 'child_process'
import type {
  DockerContainersScanResult,
  DockerContainerSummary,
  DockerImagesScanResult,
  DockerImageSummary,
  DockerRemoveResult
} from '@shared/types'

interface DockerImageRow {
  ID?: string
  Repository?: string
  Tag?: string
  Size?: string
  CreatedAt?: string
  CreatedSince?: string
}

interface DockerContainerRow {
  ID?: string
  ImageID?: string
  Image?: string
  Command?: string
  Status?: string
  RunningFor?: string
  Names?: string
  Ports?: string
  Size?: string
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

export async function removeDockerImages(imageIds: string[]): Promise<DockerRemoveResult> {
  const deletedIds: string[] = []
  const errors: string[] = []

  for (const imageId of imageIds) {
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

async function runDockerJsonLines<T>(args: string[]): Promise<
  | { status: 'ready'; rows: T[]; message: null }
  | { status: 'not_installed' | 'daemon_unavailable'; rows: T[]; message: string }
> {
  try {
    const { stdout } = await runDockerCommand(args)
    const rows = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T)

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
    createdAt: String(row.CreatedAt ?? '-'),
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
    imageId: String(row.ImageID ?? '').trim(),
    command: String(row.Command ?? '').trim(),
    status: status || '-',
    createdSince: String(row.RunningFor ?? '-'),
    ports: String(row.Ports ?? '').trim(),
    sizeBytes: parseDockerSize(sizeLabel),
    sizeLabel,
    running: /^up\b/i.test(status)
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
