import { useEffect, useMemo, useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { useToast } from '../../components/Toast'
import type { DockerRemoveResult, DockerVolumeSummary, DockerVolumesScanResult } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'
import { CopyableValue } from '../../components/CopyableValue'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../../hooks/useResponsiveLayout'
import { CompactMetaItem, compactActionsStyle, compactCardHeaderStyle, compactCardStyle, compactListStyle, compactMetaGridStyle } from '../../components/CompactPrimitives'

export function shouldUseDockerVolumesCompactLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.dockerPageCompact)
}

export function DockerVolumes({
  refreshToken = 0,
  onChanged
}: {
  refreshToken?: number
  onChanged?: () => void
}) {
  const [containerRef, containerWidth] = useContainerWidth(1100)
  const showToast = useToast((s) => s.show)
  const { tk } = useI18n()
  const [loading, setLoading] = useState(false)
  const [volumes, setVolumes] = useState<DockerVolumeSummary[]>([])
  const [status, setStatus] = useState<DockerVolumesScanResult['status']>('ready')
  const [message, setMessage] = useState<string | null>(tk('docker.volumes.initial'))
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())

  const removableVolumes = useMemo(() => volumes.filter((volume) => !volume.inUse), [volumes])
  const selectedRemovableCount = useMemo(
    () => removableVolumes.filter((volume) => selectedNames.has(volume.name)).length,
    [removableVolumes, selectedNames]
  )
  const allRemovableChecked = removableVolumes.length > 0 && selectedRemovableCount === removableVolumes.length
  const compactLayout = shouldUseDockerVolumesCompactLayout(containerWidth)

  const scanVolumes = async () => {
    setLoading(true)
    const res = await window.systemScope.listDockerVolumes()
    if (!res.ok) {
      setStatus('daemon_unavailable')
      setVolumes([])
      setMessage(res.error?.message ?? tk('docker.volumes.load_failed'))
      setLoading(false)
      return
    }
    if (!res.data) {
      setLoading(false)
      return
    }

    const data = res.data as DockerVolumesScanResult
    setStatus(data.status)
    setVolumes(data.volumes)
    setMessage(data.message)
    setSelectedNames(new Set())
    setLoading(false)
  }

  useEffect(() => {
    void scanVolumes()
  }, [refreshToken])

  const handleDelete = async (names: string[]) => {
    const res = await window.systemScope.removeDockerVolumes(names)
    if (!res.ok) {
      showToast(res.error?.message ?? tk('docker.volumes.delete_failed'))
      return
    }
    if (!res.data) return

    const result = res.data as DockerRemoveResult
    if (result.cancelled) return

    if (result.deletedIds.length > 0) {
      showToast(tk('docker.volumes.deleted', { count: result.deletedIds.length }))
      setVolumes((prev) => prev.filter((volume) => !result.deletedIds.includes(volume.name)))
      setSelectedNames((prev) => {
        const next = new Set(prev)
        result.deletedIds.forEach((name) => next.delete(name))
        return next
      })
      onChanged?.()
    }
    if (result.failCount > 0 && result.errors.length > 0) {
      showToast(tk('docker.volumes.partial', { message: result.errors[0] }))
    }
  }

  return (
    <Accordion
      title={tk('docker.volumes.title')}
      defaultOpen
      badge={status === 'ready' && volumes.length > 0 ? tk('docker.volumes.badge', { count: volumes.length }) : undefined}
      badgeColor="var(--accent-cyan)"
      actions={
        <>
          <button onClick={() => void scanVolumes()} disabled={loading} style={actionBtnStyle}>
            {loading ? tk('common.refreshing') : tk('apps.action.refresh')}
          </button>
          <button
            onClick={() => void handleDelete(Array.from(selectedNames))}
            disabled={loading || selectedRemovableCount === 0}
            style={{ ...actionBtnStyle, background: 'var(--accent-red)' }}
          >
            {tk('common.delete_selected')}
          </button>
        </>
      }
    >
      {status !== 'ready' ? (
        <EmptyState
          title={status === 'not_installed' ? tk('main.docker.status.not_installed') : tk('main.docker.status.daemon_unavailable')}
          detail={message ?? tk('docker.common.check_status')}
        />
      ) : volumes.length === 0 ? (
        <EmptyState
          title={message ?? tk('main.docker.volumes.empty')}
          detail={tk('docker.volumes.empty_detail')}
        />
      ) : (
        <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {tk('docker.volumes.helper')}
          </div>
          {compactLayout ? (
            <div style={compactListStyle}>
              {volumes.map((volume) => (
                <div key={volume.name} style={compactCardStyle}>
                  <div style={compactCardHeaderStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{volume.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                        <CopyableValue value={volume.mountpoint} fontSize="12px" color="var(--text-muted)" multiline maxWidth="100%" />
                      </div>
                    </div>
                    <Badge text={volume.inUse ? tk('docker.images.in_use') : tk('docker.images.unused')} color={volume.inUse ? 'var(--accent-yellow)' : 'var(--accent-green)'} />
                  </div>
                  <div style={compactMetaGridStyle}>
                    <CompactMetaItem label={tk('docker.volumes.table.driver')} value={volume.driver} mono />
                    <CompactMetaItem label={tk('docker.volumes.table.attached')} value={volume.containers.join(', ') || '-'} multiline muted={volume.containers.length === 0} />
                  </div>
                  <div style={compactActionsStyle}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={selectedNames.has(volume.name)}
                        disabled={volume.inUse}
                        onChange={(event) => {
                          setSelectedNames((prev) => {
                            const next = new Set(prev)
                            if (event.target.checked) next.add(volume.name)
                            else next.delete(volume.name)
                            return next
                          })
                        }}
                      />
                      Select
                    </label>
                    <button
                      onClick={() => void handleDelete([volume.name])}
                      disabled={volume.inUse || loading}
                      style={{
                        ...actionBtnStyle,
                        background: volume.inUse ? 'var(--bg-card-hover)' : 'var(--accent-red)',
                        color: volume.inUse ? 'var(--text-muted)' : 'var(--text-on-accent)',
                        cursor: volume.inUse ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {tk('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ maxHeight: '520px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <th style={{ ...thStyle, width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={allRemovableChecked}
                      disabled={removableVolumes.length === 0}
                      onChange={(event) => {
                        if (event.target.checked) setSelectedNames(new Set(removableVolumes.map((volume) => volume.name)))
                        else setSelectedNames(new Set())
                      }}
                    />
                  </th>
                  <th style={thStyle}>{tk('apps.table.name')}</th>
                  <th style={thStyle}>{tk('docker.volumes.table.driver')}</th>
                  <th style={thStyle}>{tk('docker.images.status')}</th>
                  <th style={thStyle}>{tk('docker.volumes.table.attached')}</th>
                  <th style={{ ...thStyle, width: '92px', textAlign: 'center' }}>{tk('process.port_finder.action')}</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((volume) => (
                  <tr key={volume.name} style={rowStyle}>
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={selectedNames.has(volume.name)}
                        disabled={volume.inUse}
                        onChange={(event) => {
                          setSelectedNames((prev) => {
                            const next = new Set(prev)
                            if (event.target.checked) next.add(volume.name)
                            else next.delete(volume.name)
                            return next
                          })
                        }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{volume.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5, maxWidth: '320px' }}>
                        <CopyableValue value={volume.mountpoint} fontSize="12px" color="var(--text-muted)" multiline maxWidth="320px" />
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{volume.driver}</td>
                    <td style={tdStyle}>
                      <Badge text={volume.inUse ? tk('docker.images.in_use') : tk('docker.images.unused')} color={volume.inUse ? 'var(--accent-yellow)' : 'var(--accent-green)'} />
                    </td>
                    <td style={{ ...tdStyle, lineHeight: 1.45 }}>{volume.containers.length > 0 ? volume.containers.join(', ') : '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        onClick={() => void handleDelete([volume.name])}
                        disabled={volume.inUse || loading}
                        style={{
                          ...actionBtnStyle,
                          background: volume.inUse ? 'var(--bg-card-hover)' : 'var(--accent-red)',
                          color: volume.inUse ? 'var(--text-muted)' : 'var(--text-on-accent)',
                          cursor: volume.inUse ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {tk('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
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
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: `${color}20`, color }}>
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
