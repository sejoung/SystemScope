import type { DockerActionResult, DockerContainerSummary, DockerContainersScanResult, DockerImageSummary, DockerImagesScanResult, DockerRemoveResult } from '@shared/types'
import { logInfo, logWarn } from '@main/services/core/logging'
import { tk } from '../../i18n'
import { normalizeDockerError, runDockerCommand, runDockerJsonLines, validateDockerId } from './dockerCommand'
import { type DockerContainerRow, type DockerImageRow, toDockerContainerSummary, toDockerImageSummary } from './dockerMappers'

export { listDockerVolumes, removeDockerVolumes, getDockerBuildCache, pruneDockerBuildCache } from './dockerResources'

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
