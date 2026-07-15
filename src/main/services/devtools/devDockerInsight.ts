import type { DevDockerInsight } from '@shared/types'
import { getDockerBuildCache, listDockerContainers, listDockerImages, listDockerVolumes } from '@main/services/docker/dockerImages'

const DOCKER_INSIGHT_TTL_MS = 15_000
let cachedDockerInsight: { value: DevDockerInsight; cachedAt: number } | null = null
let dockerInsightInflight: Promise<DevDockerInsight> | null = null
export function resetDevToolsOverviewCacheForTest(): void { cachedDockerInsight = null; dockerInsightInflight = null }

export async function collectDockerInsight(): Promise<DevDockerInsight> {
  const now = Date.now()
  if (cachedDockerInsight && now - cachedDockerInsight.cachedAt < DOCKER_INSIGHT_TTL_MS) {
    return cachedDockerInsight.value
  }
  if (dockerInsightInflight) {
    return dockerInsightInflight
  }

  dockerInsightInflight = loadDockerInsight()
  try {
    const value = await dockerInsightInflight
    cachedDockerInsight = { value, cachedAt: Date.now() }
    return value
  } finally {
    dockerInsightInflight = null
  }
}

async function loadDockerInsight(): Promise<DevDockerInsight> {
  const [containers, images, volumes, buildCache] = await Promise.all([
    listDockerContainers().catch(() => ({
      status: 'daemon_unavailable' as const,
      containers: [],
      message: 'Docker daemon could not be reached.',
    })),
    listDockerImages().catch(() => ({
      status: 'daemon_unavailable' as const,
      images: [],
      message: 'Docker image data could not be loaded.',
    })),
    listDockerVolumes().catch(() => ({
      status: 'daemon_unavailable' as const,
      volumes: [],
      message: 'Docker volume data could not be loaded.',
    })),
    getDockerBuildCache().catch(() => ({
      status: 'daemon_unavailable' as const,
      summary: null,
      message: 'Docker build cache data could not be loaded.',
    })),
  ])

  const statuses = [containers.status, images.status, volumes.status, buildCache.status]
  const firstMessage =
    containers.message
    ?? images.message
    ?? volumes.message
    ?? buildCache.message
    ?? null

  let status: DevDockerInsight['status'] = 'healthy'
  let detail = 'Docker Engine is ready.'
  let hint: string | null = null

  if (statuses.includes('not_installed')) {
    status = 'missing'
    detail = 'Docker is not installed.'
    hint = firstMessage ?? 'Install Docker Desktop or Docker Engine.'
  } else if (statuses.some((entry) => entry !== 'ready')) {
    status = 'warning'
    detail = 'Docker needs attention.'
    hint = firstMessage ?? 'Start Docker Desktop or Docker Engine.'
  }

  return {
    status,
    detail,
    hint,
    runningContainers: containers.status === 'ready'
      ? containers.containers.filter((container) => container.running).length
      : 0,
    stoppedContainers: containers.status === 'ready'
      ? containers.containers.filter((container) => !container.running).length
      : 0,
    unusedImages: images.status === 'ready'
      ? images.images.filter((image) => !image.inUse).length
      : 0,
    unusedVolumes: volumes.status === 'ready'
      ? volumes.volumes.filter((volume) => !volume.inUse).length
      : 0,
    reclaimableBuildCacheBytes: buildCache.status === 'ready'
      ? (buildCache.summary?.reclaimableBytes ?? 0)
      : 0,
    reclaimableBuildCacheLabel: buildCache.status === 'ready'
      ? (buildCache.summary?.reclaimableLabel ?? '0 B')
      : '0 B',
  }
}

