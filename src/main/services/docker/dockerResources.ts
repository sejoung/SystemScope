import type { DockerBuildCacheScanResult, DockerPruneResult, DockerRemoveResult, DockerVolumeSummary, DockerVolumesScanResult } from '@shared/types'
import { logInfo, logWarn } from '@main/services/core/logging'
import { tk } from '../../i18n'
import { normalizeDockerError, runDockerCommand, runDockerJsonLines, validateDockerId } from './dockerCommand'
import { type DockerContainerRow, type DockerSystemDfRow, type DockerVolumeRow, normalizeByteLabel, parseDockerSize, parseReclaimedLabel, toDockerBuildCacheSummary, toDockerVolumeSummary } from './dockerMappers'

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
