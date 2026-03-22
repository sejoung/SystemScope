import { useEffect, useMemo, useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { useToast } from '../../components/Toast'
import { formatBytes } from '../../utils/format'
import type { DockerImageSummary, DockerImagesScanResult, DockerRemoveResult } from '@shared/types'

export function DockerImages({
  refreshToken = 0,
  onChanged,
  onOpenContainers
}: {
  refreshToken?: number
  onChanged?: () => void
  onOpenContainers?: () => void
}) {
  const showToast = useToast((s) => s.show)
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<DockerImageSummary[]>([])
  const [status, setStatus] = useState<DockerImagesScanResult['status']>('ready')
  const [message, setMessage] = useState<string | null>('Docker 이미지를 조회해보세요.')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectableImages = useMemo(() => images.filter((image) => !image.inUse), [images])
  const selectedSelectableCount = useMemo(
    () => selectableImages.filter((image) => selectedIds.has(image.id)).length,
    [selectableImages, selectedIds]
  )
  const allSelectableChecked = selectableImages.length > 0 && selectedSelectableCount === selectableImages.length

  const scanImages = async () => {
    setLoading(true)
    const res = await window.systemScope.listDockerImages()
    if (!res.ok || !res.data) {
      setStatus('daemon_unavailable')
      setImages([])
      setMessage(res.error?.message ?? 'Docker 이미지를 조회하지 못했습니다.')
      setLoading(false)
      return
    }

    const data = res.data as DockerImagesScanResult
    setStatus(data.status)
    setImages(data.images)
    setMessage(data.message)
    setSelectedIds(new Set())
    setLoading(false)
  }

  useEffect(() => {
    void scanImages()
  }, [refreshToken])

  const handleDelete = async (ids: string[]) => {
    const res = await window.systemScope.removeDockerImages(ids)
    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? 'Docker 이미지를 삭제하지 못했습니다.')
      return
    }

    const result = res.data as DockerRemoveResult
    if (result.cancelled) return

    if (result.deletedIds.length > 0) {
      showToast(`${result.deletedIds.length}개 Docker 이미지를 삭제했습니다.`)
      setImages((prev) => prev.filter((image) => !result.deletedIds.includes(image.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        result.deletedIds.forEach((id) => next.delete(id))
        return next
      })
      onChanged?.()
    }
    if (result.failCount > 0 && result.errors.length > 0) {
      showToast(`일부 실패: ${result.errors[0]}`)
    }
  }

  return (
    <Accordion
      title="Docker Images"
      defaultOpen
      badge={status === 'ready' && images.length > 0 ? `${images.length} images` : undefined}
      badgeColor="var(--accent-cyan)"
      actions={
        <>
          <button onClick={() => void scanImages()} disabled={loading} style={actionBtnStyle}>
            {loading ? 'Scanning...' : images.length > 0 || message ? 'Refresh' : 'Scan Images'}
          </button>
          <button
            onClick={() => void handleDelete(Array.from(selectedIds))}
            disabled={loading || selectedSelectableCount === 0}
            style={{ ...actionBtnStyle, background: 'var(--accent-red)' }}
          >
            Delete Selected
          </button>
        </>
      }
    >
      {status !== 'ready' ? (
        <EmptyState title={status === 'not_installed' ? 'Docker가 설치되어 있지 않습니다.' : 'Docker daemon에 연결할 수 없습니다.'} detail={message ?? 'Docker Desktop 또는 Docker Engine 상태를 확인하세요.'} />
      ) : images.length === 0 ? (
        <EmptyState title={message ?? 'Docker 이미지가 없습니다.'} detail="Docker가 설치되어 있다면 Scan Images로 다시 확인할 수 있습니다." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            사용 중인 이미지는 먼저 Containers 탭에서 참조 컨테이너를 정리해야 합니다. `dangling` 이미지는 태그가 없는 고아 이미지입니다.
          </div>
          <div style={{ maxHeight: '520px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <th style={{ ...thStyle, width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={allSelectableChecked}
                      disabled={selectableImages.length === 0}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedIds(new Set(selectableImages.map((image) => image.id)))
                        } else {
                          setSelectedIds(new Set())
                        }
                      }}
                    />
                  </th>
                  <th style={thStyle}>Repository</th>
                  <th style={thStyle}>Tag</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Size</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, width: '92px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {images.map((image) => {
                  const checked = selectedIds.has(image.id)
                  return (
                    <tr key={image.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={image.inUse}
                          onChange={(event) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev)
                              if (event.target.checked) next.add(image.id)
                              else next.delete(image.id)
                              return next
                            })
                          }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{image.repository}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{image.shortId}</div>
                      </td>
                      <td style={tdStyle}>{image.tag}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{formatBytes(image.sizeBytes)}</td>
                      <td style={tdStyle}>{image.createdSince}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {image.inUse && <Badge text="in use" color="var(--accent-yellow)" />}
                          {!image.inUse && <Badge text="unused" color="var(--accent-green)" />}
                          {image.dangling && <Badge text="dangling" color="var(--accent-red)" />}
                        </div>
                        {image.containers.length > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {image.containers.join(', ')}
                            {onOpenContainers && (
                              <button
                                onClick={onOpenContainers}
                                style={{
                                  marginLeft: '8px',
                                  padding: 0,
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--accent-cyan)',
                                  cursor: 'pointer',
                                  fontSize: '10px',
                                  fontWeight: 600
                                }}
                              >
                                Containers 보기
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => void handleDelete([image.id])}
                          disabled={image.inUse || loading}
                          style={{
                            ...actionBtnStyle,
                            background: image.inUse ? 'var(--bg-card-hover)' : 'var(--accent-red)',
                            color: image.inUse ? 'var(--text-muted)' : 'var(--text-on-accent)',
                            cursor: image.inUse ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Accordion>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ padding: '28px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{detail}</div>
    </div>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 700,
      padding: '2px 6px',
      borderRadius: '999px',
      background: `${color}20`,
      color
    }}>
      {text}
    </span>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 4px',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap'
}

const tdStyle: React.CSSProperties = {
  padding: '8px 4px',
  color: 'var(--text-secondary)',
  verticalAlign: 'top'
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
