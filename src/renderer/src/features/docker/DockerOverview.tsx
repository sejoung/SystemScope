import { useEffect, useMemo, useState } from 'react'
import { Accordion } from '../../components/Accordion'
import type { DockerBuildCacheScanResult, DockerContainersScanResult, DockerImagesScanResult, DockerVolumesScanResult } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'

export function DockerOverview({
  refreshToken = 0,
  onOpenContainers,
  onOpenImages,
  onOpenVolumes,
  onOpenBuildCache
}: {
  refreshToken?: number
  onOpenContainers: () => void
  onOpenImages: () => void
  onOpenVolumes: () => void
  onOpenBuildCache: () => void
}) {
  const { tk } = useI18n()
  const [loading, setLoading] = useState(false)
  const [imageScan, setImageScan] = useState<DockerImagesScanResult | null>(null)
  const [containerScan, setContainerScan] = useState<DockerContainersScanResult | null>(null)
  const [volumeScan, setVolumeScan] = useState<DockerVolumesScanResult | null>(null)
  const [buildCacheScan, setBuildCacheScan] = useState<DockerBuildCacheScanResult | null>(null)

  const refresh = async () => {
    if (loading) return
    setLoading(true)
    const [imagesRes, containersRes, volumesRes, buildCacheRes] = await Promise.all([
      window.systemScope.listDockerImages(),
      window.systemScope.listDockerContainers(),
      window.systemScope.listDockerVolumes(),
      window.systemScope.getDockerBuildCache()
    ])

    setImageScan(
      imagesRes.ok && imagesRes.data
        ? (imagesRes.data as DockerImagesScanResult)
        : { status: 'daemon_unavailable', images: [], message: !imagesRes.ok ? (imagesRes.error?.message ?? tk('docker.images.load_failed')) : tk('docker.images.load_failed') }
    )
    setContainerScan(
      containersRes.ok && containersRes.data
        ? (containersRes.data as DockerContainersScanResult)
        : { status: 'daemon_unavailable', containers: [], message: !containersRes.ok ? (containersRes.error?.message ?? tk('docker.containers.load_failed')) : tk('docker.containers.load_failed') }
    )
    setVolumeScan(
      volumesRes.ok && volumesRes.data
        ? (volumesRes.data as DockerVolumesScanResult)
        : { status: 'daemon_unavailable', volumes: [], message: !volumesRes.ok ? (volumesRes.error?.message ?? tk('docker.volumes.load_failed')) : tk('docker.volumes.load_failed') }
    )
    setBuildCacheScan(
      buildCacheRes.ok && buildCacheRes.data
        ? (buildCacheRes.data as DockerBuildCacheScanResult)
        : { status: 'daemon_unavailable', summary: null, message: !buildCacheRes.ok ? (buildCacheRes.error?.message ?? tk('docker.build_cache.load_failed')) : tk('docker.build_cache.load_failed') }
    )
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [refreshToken])

  const scans = [imageScan, containerScan, volumeScan, buildCacheScan].filter(Boolean)
  const hasFailure = scans.some((scan) => scan?.status !== 'ready')
  const dockerStatus = scans.length === 0 ? 'ready' : !hasFailure ? 'ready' : 'degraded'
  const failureMessages = scans
    .filter((scan) => scan?.status !== 'ready')
    .map((scan) => scan?.message)
    .filter((message): message is string => Boolean(message))
  const stoppedCount = useMemo(() => containerScan?.containers.filter((container) => !container.running).length ?? 0, [containerScan])
  const runningCount = useMemo(() => containerScan?.containers.filter((container) => container.running).length ?? 0, [containerScan])
  const inUseImageCount = useMemo(() => imageScan?.images.filter((image) => image.inUse).length ?? 0, [imageScan])
  const danglingImageCount = useMemo(() => imageScan?.images.filter((image) => image.dangling).length ?? 0, [imageScan])
  const unusedVolumeCount = useMemo(() => volumeScan?.volumes.filter((volume) => !volume.inUse).length ?? 0, [volumeScan])
  const reclaimableImageBytes = useMemo(
    () => imageScan?.images.filter((image) => !image.inUse).reduce((sum, image) => sum + image.sizeBytes, 0) ?? 0,
    [imageScan]
  )
  const reclaimableBuildCache = buildCacheScan?.summary?.reclaimableLabel ?? '0 B'

  const statusTitle =
    dockerStatus === 'ready'
      ? tk('docker.overview.status.ready')
      : tk('docker.overview.status.partial')

  const statusDetail =
    dockerStatus === 'ready'
      ? tk('docker.overview.ready_detail')
      : failureMessages[0] ?? tk('docker.overview.partial_detail')

  return (
    <Accordion
      title={tk('docker.tab.overview')}
      defaultOpen
      badge={dockerStatus === 'ready' ? tk('docker.overview.badge.workflow') : tk('docker.overview.badge.partial')}
      badgeColor={dockerStatus === 'ready' ? 'var(--accent-cyan)' : 'var(--accent-yellow)'}
      actions={
        <button onClick={() => void refresh()} disabled={loading} style={actionBtnStyle}>
          {loading ? tk('common.refreshing') : tk('common.refresh_all')}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{statusTitle}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{statusDetail}</div>
        </div>

        {scans.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <SummaryCard title={tk('docker.overview.card.stopped_containers')} value={String(stoppedCount)} tone="var(--accent-red)" actionLabel={tk('docker.overview.action.clean_first')} onClick={onOpenContainers} />
              <SummaryCard title={tk('docker.overview.card.running_containers')} value={String(runningCount)} tone="var(--accent-yellow)" actionLabel={tk('docker.overview.action.view')} onClick={onOpenContainers} />
              <SummaryCard title={tk('docker.overview.card.in_use_images')} value={String(inUseImageCount)} tone="var(--accent-blue)" actionLabel={tk('docker.overview.action.inspect')} onClick={onOpenImages} />
              <SummaryCard title={tk('docker.overview.card.untagged_images')} value={String(danglingImageCount)} tone="var(--accent-green)" actionLabel={tk('docker.overview.action.review')} onClick={onOpenImages} />
              <SummaryCard title={tk('docker.overview.card.unused_volumes')} value={String(unusedVolumeCount)} tone="var(--accent-cyan)" actionLabel={tk('docker.overview.action.review')} onClick={onOpenVolumes} />
              <SummaryCard title={tk('docker.overview.card.build_cache')} value={reclaimableBuildCache} tone="var(--accent-red)" actionLabel={tk('docker.overview.action.prune')} onClick={onOpenBuildCache} />
            </div>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)'
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>{tk('docker.overview.flow.title')}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                {tk('docker.overview.flow.step1_title')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {tk('docker.overview.flow.step1_detail', { count: stoppedCount })}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginTop: '10px' }}>
                {tk('docker.overview.flow.step2_title')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {tk('docker.overview.flow.step2_detail', { size: formatCompactBytes(reclaimableImageBytes) })}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginTop: '10px' }}>
                {tk('docker.overview.flow.step3_title')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {tk('docker.overview.flow.step3_detail', { volumes: unusedVolumeCount, cache: reclaimableBuildCache })}
              </div>
            </div>
          </>
        )}
      </div>
    </Accordion>
  )
}

function SummaryCard({
  title,
  value,
  tone,
  actionLabel,
  onClick
}: {
  title: string
  value: string
  tone: string
  actionLabel: string
  onClick: () => void
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)'
      }}
    >
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{title}</div>
      <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
      <button
        onClick={onClick}
        style={{
          marginTop: '12px',
          padding: '6px 10px',
          borderRadius: '8px',
          border: 'none',
          background: tone,
          color: 'var(--text-on-accent)',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 700
        }}
      >
        {actionLabel}
      </button>
    </div>
  )
}

const actionBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--accent-cyan)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}

function formatCompactBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
