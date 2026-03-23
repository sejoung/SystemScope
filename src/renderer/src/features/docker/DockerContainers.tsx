import { useEffect, useMemo, useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { useToast } from '../../components/Toast'
import { formatBytes } from '../../utils/format'
import type { DockerActionResult, DockerContainerSummary, DockerContainersScanResult, DockerRemoveResult } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'

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
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [containers, setContainers] = useState<DockerContainerSummary[]>([])
  const [status, setStatus] = useState<DockerContainersScanResult['status']>('ready')
  const [message, setMessage] = useState<string | null>(t('Docker 컨테이너를 조회해보세요.'))
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
      setMessage(res.error?.message ?? t('Docker 컨테이너를 조회하지 못했습니다.'))
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
      showToast(res.error?.message ?? t('Docker 컨테이너를 삭제하지 못했습니다.'))
      return
    }

    const result = res.data as DockerRemoveResult
    if (result.cancelled) return

    if (result.deletedIds.length > 0) {
      showToast(t('{count}개 Docker 컨테이너를 삭제했습니다.', { count: result.deletedIds.length }))
      setContainers((prev) => prev.filter((container) => !result.deletedIds.includes(container.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        result.deletedIds.forEach((id) => next.delete(id))
        return next
      })
      onChanged?.()
    }
    if (result.failCount > 0 && result.errors.length > 0) {
      showToast(t('일부 실패: {message}', { message: result.errors[0] }))
    }
  }

  const handleStop = async (ids: string[]) => {
    const res = await window.systemScope.stopDockerContainers(ids)
    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? t('Docker 컨테이너를 중지하지 못했습니다.'))
      return
    }

    const result = res.data as DockerActionResult
    if (result.cancelled) return

    if (result.affectedIds.length > 0) {
      showToast(t('{count}개 Docker 컨테이너를 중지했습니다.', { count: result.affectedIds.length }))
      setContainers((prev) =>
        prev.map((container) =>
          result.affectedIds.includes(container.id)
            ? { ...container, running: false, status: 'Exited (stopped by SystemScope)' }
            : container
        )
      )
      onChanged?.()
    }
    if (result.failCount > 0 && result.errors.length > 0) {
      showToast(t('일부 실패: {message}', { message: result.errors[0] }))
    }
  }

  return (
    <Accordion
      title={t('Containers')}
      defaultOpen
      badge={status === 'ready' && containers.length > 0 ? t('{count} containers', { count: containers.length }) : undefined}
      badgeColor="var(--accent-cyan)"
      actions={
        <>
          <button onClick={() => void scanContainers()} disabled={loading} style={actionBtnStyle}>
            {loading ? t('Refreshing...') : t('Refresh')}
          </button>
          <button
            onClick={() => void handleDelete(Array.from(selectedIds))}
            disabled={loading || selectedRemovableCount === 0}
            style={{ ...actionBtnStyle, background: 'var(--accent-red)' }}
          >
            {t('Remove Selected')}
          </button>
        </>
      }
    >
      {status !== 'ready' ? (
        <EmptyState
          title={status === 'not_installed' ? t('Docker가 설치되어 있지 않습니다.') : t('Docker daemon에 연결할 수 없습니다.')}
          detail={message ?? t('Docker Desktop 또는 Docker Engine 상태를 확인하세요.')}
        />
      ) : containers.length === 0 ? (
        <EmptyState
          title={message ?? t('정리할 Docker 컨테이너가 없습니다.')}
          detail={t('종료된 컨테이너가 있으면 여기서 먼저 정리한 뒤 Images 탭으로 이동하세요.')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('종료된 컨테이너를 먼저 정리하면 Images 탭에서 참조 중으로 막힌 이미지 삭제가 가능해집니다.')}
            {runningContainers.length > 0 && (
              <button
                onClick={() => void handleStop(runningContainers.map((container) => container.id))}
                style={{ marginLeft: '8px', padding: 0, border: 'none', background: 'transparent', color: 'var(--accent-yellow)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                {t('running {count}개 중지', { count: runningContainers.length })}
              </button>
            )}
            {onOpenImages && (
              <button
                onClick={onOpenImages}
                style={{ marginLeft: '8px', padding: 0, border: 'none', background: 'transparent', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                {t('Images 보기')}
              </button>
            )}
          </div>
          <div style={{ maxHeight: '520px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
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
                  <th style={thStyle}>{t('Container')}</th>
                  <th style={thStyle}>{t('Image')}</th>
                  <th style={thStyle}>{t('Status')}</th>
                  <th style={thStyle}>{t('Ports')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('Writable')}</th>
                  <th style={{ ...thStyle, width: '160px', textAlign: 'center' }}>{t('Action')}</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((container) => (
                  <tr key={container.id} style={{ borderBottom: '1px solid var(--border)' }}>
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
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{container.shortId}</div>
                    </td>
                    <td style={tdStyle}>
                      <div>{container.image}</div>
                      {container.command && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>
                          {container.command}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <Badge text={container.running ? t('running') : t('stopped')} color={container.running ? 'var(--accent-yellow)' : 'var(--accent-green)'} />
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{container.status}</div>
                    </td>
                    <td style={tdStyle}>{container.ports || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{formatBytes(container.sizeBytes)}</td>
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
      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{detail}</div>
    </div>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 6px',
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
