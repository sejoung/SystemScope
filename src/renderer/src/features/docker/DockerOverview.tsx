import { useEffect, useMemo, useState } from 'react'
import { Accordion } from '../../components/Accordion'
import type { DockerContainersScanResult, DockerImagesScanResult } from '@shared/types'

export function DockerOverview({
  refreshToken = 0,
  onOpenContainers,
  onOpenImages
}: {
  refreshToken?: number
  onOpenContainers: () => void
  onOpenImages: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [imageScan, setImageScan] = useState<DockerImagesScanResult | null>(null)
  const [containerScan, setContainerScan] = useState<DockerContainersScanResult | null>(null)

  const refresh = async () => {
    setLoading(true)
    const [imagesRes, containersRes] = await Promise.all([
      window.systemScope.listDockerImages(),
      window.systemScope.listDockerContainers()
    ])

    setImageScan(
      imagesRes.ok && imagesRes.data
        ? (imagesRes.data as DockerImagesScanResult)
        : { status: 'daemon_unavailable', images: [], message: imagesRes.error?.message ?? 'Docker 이미지를 조회하지 못했습니다.' }
    )
    setContainerScan(
      containersRes.ok && containersRes.data
        ? (containersRes.data as DockerContainersScanResult)
        : { status: 'daemon_unavailable', containers: [], message: containersRes.error?.message ?? 'Docker 컨테이너를 조회하지 못했습니다.' }
    )
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [refreshToken])

  const dockerStatus = imageScan?.status ?? containerScan?.status ?? 'ready'
  const stoppedCount = useMemo(() => containerScan?.containers.filter((container) => !container.running).length ?? 0, [containerScan])
  const runningCount = useMemo(() => containerScan?.containers.filter((container) => container.running).length ?? 0, [containerScan])
  const inUseImageCount = useMemo(() => imageScan?.images.filter((image) => image.inUse).length ?? 0, [imageScan])
  const danglingImageCount = useMemo(() => imageScan?.images.filter((image) => image.dangling).length ?? 0, [imageScan])
  const reclaimableImageBytes = useMemo(
    () => imageScan?.images.filter((image) => !image.inUse).reduce((sum, image) => sum + image.sizeBytes, 0) ?? 0,
    [imageScan]
  )

  const statusTitle =
    dockerStatus === 'not_installed'
      ? 'Docker가 설치되어 있지 않습니다.'
      : dockerStatus === 'daemon_unavailable'
        ? 'Docker daemon에 연결할 수 없습니다.'
        : 'Docker Cleanup Summary'

  const statusDetail =
    dockerStatus === 'ready'
      ? '이미지 정리 전에 종료된 컨테이너를 먼저 비우면 참조 때문에 막히는 삭제를 줄일 수 있습니다.'
      : imageScan?.message ?? containerScan?.message ?? 'Docker Desktop 또는 Docker Engine 상태를 확인하세요.'

  return (
    <Accordion
      title="Overview"
      defaultOpen
      badge={dockerStatus === 'ready' ? 'workflow' : undefined}
      badgeColor="var(--accent-cyan)"
      actions={
        <button onClick={() => void refresh()} disabled={loading} style={actionBtnStyle}>
          {loading ? 'Refreshing...' : 'Refresh All'}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{statusTitle}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{statusDetail}</div>
        </div>

        {dockerStatus === 'ready' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <SummaryCard title="Stopped Containers" value={String(stoppedCount)} tone="var(--accent-red)" actionLabel="Clean First" onClick={onOpenContainers} />
              <SummaryCard title="Running Containers" value={String(runningCount)} tone="var(--accent-yellow)" actionLabel="View" onClick={onOpenContainers} />
              <SummaryCard title="In-use Images" value={String(inUseImageCount)} tone="var(--accent-blue)" actionLabel="Inspect" onClick={onOpenImages} />
              <SummaryCard title="Dangling Images" value={String(danglingImageCount)} tone="var(--accent-green)" actionLabel="Delete" onClick={onOpenImages} />
            </div>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)'
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Recommended Flow</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                1. 종료된 컨테이너 정리
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                stopped container {stoppedCount}개를 먼저 제거하면 이미지 참조가 풀립니다.
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginTop: '10px' }}>
                2. 사용하지 않는 이미지 정리
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                현재 바로 정리 가능한 이미지 용량은 {formatCompactBytes(reclaimableImageBytes)} 입니다.
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
