import { useEffect, useMemo, useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { useToast } from '../../components/Toast'
import { formatBytes } from '../../utils/format'
import type { DockerActionResult, DockerContainerSummary, DockerContainersScanResult, DockerRemoveResult } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'
import { CopyableValue } from '../../components/CopyableValue'

export function DockerContainers({
  refreshToken = 0,
  onChanged,
  onOpenImages
}: {
  refreshToken?: number
  onChanged?: () => void
  onOpenImages?: () => void
}) {
  const showToast = useToast((s) => s.show)
  const { tk } = useI18n()
  const [loading, setLoading] = useState(false)
  const [containers, setContainers] = useState<DockerContainerSummary[]>([])
  const [status, setStatus] = useState<DockerContainersScanResult['status']>('ready')
  const [message, setMessage] = useState<string | null>(tk('docker.containers.initial'))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const removableContainers = useMemo(() => containers.filter((container) => !container.running), [containers])
  const runningContainers = useMemo(() => containers.filter((container) => container.running), [containers])
  const selectedRemovableCount = useMemo(
    () => removableContainers.filter((container) => selectedIds.has(container.id)).length,
    [removableContainers, selectedIds]
  )
  const allRemovableChecked = removableContainers.length > 0 && selectedRemovableCount === removableContainers.length

  const scanContainers = async () => {
    setLoading(true)
    const res = await window.systemScope.listDockerContainers()
    if (!res.ok || !res.data) {
      setStatus('daemon_unavailable')
      setContainers([])
      setMessage(res.error?.message ?? tk('docker.containers.load_failed'))
      setLoading(false)
      return
    }

    const data = res.data as DockerContainersScanResult
    setStatus(data.status)
    setContainers(data.containers)
    setMessage(data.message)
    setSelectedIds(new Set())
    setLoading(false)
  }

  useEffect(() => {
    void scanContainers()
  }, [refreshToken])

  const handleDelete = async (ids: string[]) => {
    const res = await window.systemScope.removeDockerContainers(ids)
    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? tk('docker.containers.delete_failed'))
      return
    }

    const result = res.data as DockerRemoveResult
    if (result.cancelled) return

    if (result.deletedIds.length > 0) {
      showToast(tk('docker.containers.deleted', { count: result.deletedIds.length }))
      setContainers((prev) => prev.filter((container) => !result.deletedIds.includes(container.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        result.deletedIds.forEach((id) => next.delete(id))
        return next
      })
      onChanged?.()
    }
    if (result.failCount > 0 && result.errors.length > 0) {
      showToast(tk('docker.containers.partial', { message: result.errors[0] }))
    }
  }

  const handleStop = async (ids: string[]) => {
    const res = await window.systemScope.stopDockerContainers(ids)
    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? tk('docker.containers.stop_failed'))
      return
    }

    const result = res.data as DockerActionResult
    if (result.cancelled) return

    if (result.affectedIds.length > 0) {
      showToast(tk('docker.containers.stopped', { count: result.affectedIds.length }))
      setContainers((prev) =>
        prev.map((container) =>
          result.affectedIds.includes(container.id)
            ? { ...container, running: false, status: tk('docker.containers.stopped_by_app') }
            : container
        )
      )
      onChanged?.()
    }
    if (result.failCount > 0 && result.errors.length > 0) {
      showToast(tk('docker.containers.partial', { message: result.errors[0] }))
    }
  }

  return (
    <Accordion
      title={tk('docker.containers.title')}
      defaultOpen
      badge={status === 'ready' && containers.length > 0 ? tk('docker.containers.badge', { count: containers.length }) : undefined}
      badgeColor="var(--accent-cyan)"
      actions={
        <>
          <button onClick={() => void scanContainers()} disabled={loading} style={actionBtnStyle}>
            {loading ? tk('common.refreshing') : tk('apps.action.refresh')}
          </button>
          <button
            onClick={() => void handleDelete(Array.from(selectedIds))}
            disabled={loading || selectedRemovableCount === 0}
            style={{ ...actionBtnStyle, background: 'var(--accent-red)' }}
          >
            {tk('docker.containers.remove_selected')}
          </button>
        </>
      }
    >
      {status !== 'ready' ? (
        <EmptyState
          title={status === 'not_installed' ? tk('main.docker.status.not_installed') : tk('main.docker.status.daemon_unavailable')}
          detail={message ?? tk('docker.common.check_status')}
        />
      ) : containers.length === 0 ? (
        <EmptyState
          title={message ?? tk('docker.containers.empty_title')}
          detail={tk('docker.containers.empty_detail')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {tk('docker.containers.helper')}
            {runningContainers.length > 0 && (
              <button
                onClick={() => void handleStop(runningContainers.map((container) => container.id))}
                style={{ marginLeft: '8px', padding: 0, border: 'none', background: 'transparent', color: 'var(--accent-yellow)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                {tk('docker.containers.stop_running', { count: runningContainers.length })}
              </button>
            )}
            {onOpenImages && (
              <button
                onClick={onOpenImages}
                style={{ marginLeft: '8px', padding: 0, border: 'none', background: 'transparent', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                {tk('docker.containers.open_images')}
              </button>
            )}
          </div>
          <div style={{ maxHeight: '520px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <th style={{ ...thStyle, width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={allRemovableChecked}
                      disabled={removableContainers.length === 0}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedIds(new Set(removableContainers.map((container) => container.id)))
                        } else {
                          setSelectedIds(new Set())
                        }
                      }}
                    />
                  </th>
                  <th style={thStyle}>{tk('docker.containers.table.container')}</th>
                  <th style={thStyle}>{tk('docker.containers.table.image')}</th>
                  <th style={thStyle}>{tk('docker.containers.table.status')}</th>
                  <th style={thStyle}>{tk('docker.containers.table.ports')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{tk('docker.containers.table.writable')}</th>
                  <th style={{ ...thStyle, width: '160px', textAlign: 'center' }}>{tk('process.port_finder.action')}</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((container) => (
                  <tr key={container.id} style={rowStyle}>
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(container.id)}
                        disabled={container.running}
                        onChange={(event) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (event.target.checked) next.add(container.id)
                            else next.delete(container.id)
                            return next
                          })
                        }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{container.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>{container.shortId}</div>
                    </td>
                    <td style={tdStyle}>
                      <div>{container.image}</div>
                      {container.command && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '6px', lineHeight: 1.5, maxWidth: '320px' }}>
                          <CopyableValue value={container.command} fontSize="12px" color="var(--text-muted)" multiline maxWidth="320px" />
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <Badge text={container.running ? tk('docker.containers.running') : tk('docker.containers.stopped_label')} color={container.running ? 'var(--accent-yellow)' : 'var(--accent-green)'} />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.45 }}>{container.status}</div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', lineHeight: 1.45 }}>{container.ports || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatBytes(container.sizeBytes)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => void handleStop([container.id])}
                          disabled={!container.running || loading}
                          style={{
                            ...actionBtnStyle,
                            background: container.running ? 'var(--accent-yellow)' : 'var(--bg-card-hover)',
                            color: container.running ? 'var(--text-on-accent)' : 'var(--text-muted)',
                            cursor: container.running ? 'pointer' : 'not-allowed'
                          }}
                        >
                          Stop
                        </button>
                        <button
                          onClick={() => void handleDelete([container.id])}
                          disabled={container.running || loading}
                          style={{
                            ...actionBtnStyle,
                            background: container.running ? 'var(--bg-card-hover)' : 'var(--accent-red)',
                            color: container.running ? 'var(--text-muted)' : 'var(--text-on-accent)',
                            cursor: container.running ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: '999px',
        background: `${color}20`,
        color
      }}
    >
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
