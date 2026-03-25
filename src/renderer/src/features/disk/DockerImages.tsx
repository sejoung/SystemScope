import { useEffect, useMemo, useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { useToast } from '../../components/Toast'
import { formatBytes } from '../../utils/format'
import type { DockerImageSummary, DockerImagesScanResult, DockerRemoveResult } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'

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
  const { tk } = useI18n()
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<DockerImageSummary[]>([])
  const [status, setStatus] = useState<DockerImagesScanResult['status']>('ready')
  const [message, setMessage] = useState<string | null>(tk('docker.images.initial'))
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
      setMessage(res.error?.message ?? tk('docker.images.load_failed'))
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
      showToast(res.error?.message ?? tk('docker.images.delete_failed'))
      return
    }

    const result = res.data as DockerRemoveResult
    if (result.cancelled) return

    if (result.deletedIds.length > 0) {
      showToast(tk('docker.images.deleted', { count: result.deletedIds.length }))
      setImages((prev) => prev.filter((image) => !result.deletedIds.includes(image.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        result.deletedIds.forEach((id) => next.delete(id))
        return next
      })
      onChanged?.()
    }
    if (result.failCount > 0 && result.errors.length > 0) {
      showToast(tk('docker.images.partial', { message: result.errors[0] }))
    }
  }

  return (
    <Accordion
      title={tk('docker.images.title')}
      defaultOpen
      badge={status === 'ready' && images.length > 0 ? tk('docker.images.badge', { count: images.length }) : undefined}
      badgeColor="var(--accent-cyan)"
      actions={
        <>
          <button onClick={() => void scanImages()} disabled={loading} style={actionBtnStyle}>
            {loading ? tk('common.scanning') : images.length > 0 || message ? tk('apps.action.refresh') : tk('docker.images.scan_action')}
          </button>
          <button
            onClick={() => void handleDelete(Array.from(selectedIds))}
            disabled={loading || selectedSelectableCount === 0}
            style={{ ...actionBtnStyle, background: 'var(--accent-red)' }}
          >
            {tk('common.delete_selected')}
          </button>
        </>
      }
    >
      {status !== 'ready' ? (
        <EmptyState title={status === 'not_installed' ? tk('main.docker.status.not_installed') : tk('main.docker.status.daemon_unavailable')} detail={message ?? tk('docker.common.check_status')} />
      ) : images.length === 0 ? (
        <EmptyState title={message ?? tk('main.docker.images.empty')} detail={tk('docker.images.empty_detail')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {tk('docker.images.helper')}
          </div>
          <div style={{ maxHeight: '520px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
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
                  <th style={thStyle}>{tk('docker.images.repository')}</th>
                  <th style={thStyle}>{tk('docker.images.tag')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{tk('docker.images.size')}</th>
                  <th style={thStyle}>{tk('docker.images.created')}</th>
                  <th style={thStyle}>{tk('docker.images.status')}</th>
                  <th style={{ ...thStyle, width: '92px', textAlign: 'center' }}>{tk('process.port_finder.action')}</th>
                </tr>
              </thead>
              <tbody>
                {images.map((image) => {
                  const checked = selectedIds.has(image.id)
                  return (
                    <tr key={image.id} style={rowStyle}>
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
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>{image.shortId}</div>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{image.tag}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatBytes(image.sizeBytes)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{image.createdSince}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {image.inUse && <Badge text={tk('docker.images.in_use')} color="var(--accent-yellow)" />}
                          {!image.inUse && <Badge text={tk('docker.images.unused')} color="var(--accent-green)" />}
                          {image.dangling && <Badge text={tk('docker.images.untagged')} color="var(--accent-red)" />}
                        </div>
                        {image.containers.length > 0 && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.45 }}>
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
                                  fontSize: '12px',
                                  fontWeight: 600
                                }}
                              >
                                {tk('docker.images.open_containers')}
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
                          {tk('common.delete')}
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
      <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{detail}</div>
    </div>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 700,
      padding: '3px 8px',
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
  padding: '12px 8px',
  color: 'var(--text-muted)',
  fontWeight: 600,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap'
}

const tdStyle: React.CSSProperties = {
  padding: '12px 8px',
  color: 'var(--text-secondary)',
  verticalAlign: 'top',
  fontSize: '14px',
  lineHeight: 1.4
}

const actionBtnStyle: React.CSSProperties = {
  padding: '7px 12px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--accent-cyan)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}

const rowStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)'
}
