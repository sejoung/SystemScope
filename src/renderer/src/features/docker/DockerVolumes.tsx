import { useEffect, useMemo, useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { useToast } from '../../components/Toast'
import type { DockerRemoveResult, DockerVolumeSummary, DockerVolumesScanResult } from '@shared/types'

export function DockerVolumes({
  refreshToken = 0,
  onChanged
}: {
  refreshToken?: number
  onChanged?: () => void
}) {
  const showToast = useToast((s) => s.show)
  const [loading, setLoading] = useState(false)
  const [volumes, setVolumes] = useState<DockerVolumeSummary[]>([])
  const [status, setStatus] = useState<DockerVolumesScanResult['status']>('ready')
  const [message, setMessage] = useState<string | null>('Docker 볼륨을 조회해보세요.')
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())

  const removableVolumes = useMemo(() => volumes.filter((volume) => !volume.inUse), [volumes])
  const selectedRemovableCount = useMemo(
    () => removableVolumes.filter((volume) => selectedNames.has(volume.name)).length,
    [removableVolumes, selectedNames]
  )
  const allRemovableChecked = removableVolumes.length > 0 && selectedRemovableCount === removableVolumes.length

  const scanVolumes = async () => {
    setLoading(true)
    const res = await window.systemScope.listDockerVolumes()
    if (!res.ok || !res.data) {
      setStatus('daemon_unavailable')
      setVolumes([])
      setMessage(res.error?.message ?? 'Docker 볼륨을 조회하지 못했습니다.')
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
    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? 'Docker 볼륨을 삭제하지 못했습니다.')
      return
    }

    const result = res.data as DockerRemoveResult
    if (result.cancelled) return

    if (result.deletedIds.length > 0) {
      showToast(`${result.deletedIds.length}개 Docker 볼륨을 삭제했습니다.`)
      setVolumes((prev) => prev.filter((volume) => !result.deletedIds.includes(volume.name)))
      setSelectedNames((prev) => {
        const next = new Set(prev)
        result.deletedIds.forEach((name) => next.delete(name))
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
      title="Volumes"
      defaultOpen
      badge={status === 'ready' && volumes.length > 0 ? `${volumes.length} volumes` : undefined}
      badgeColor="var(--accent-cyan)"
      actions={
        <>
          <button onClick={() => void scanVolumes()} disabled={loading} style={actionBtnStyle}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => void handleDelete(Array.from(selectedNames))}
            disabled={loading || selectedRemovableCount === 0}
            style={{ ...actionBtnStyle, background: 'var(--accent-red)' }}
          >
            Delete Selected
          </button>
        </>
      }
    >
      {status !== 'ready' ? (
        <EmptyState
          title={status === 'not_installed' ? 'Docker가 설치되어 있지 않습니다.' : 'Docker daemon에 연결할 수 없습니다.'}
          detail={message ?? 'Docker Desktop 또는 Docker Engine 상태를 확인하세요.'}
        />
      ) : volumes.length === 0 ? (
        <EmptyState
          title={message ?? 'Docker 볼륨이 없습니다.'}
          detail="사용 중이 아닌 볼륨만 여기서 정리할 수 있습니다."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            컨테이너에서 붙잡고 있는 볼륨은 삭제할 수 없습니다.
          </div>
          <div style={{ maxHeight: '520px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
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
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Driver</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Attached Containers</th>
                  <th style={{ ...thStyle, width: '92px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((volume) => (
                  <tr key={volume.name} style={{ borderBottom: '1px solid var(--border)' }}>
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
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{volume.mountpoint}</div>
                    </td>
                    <td style={tdStyle}>{volume.driver}</td>
                    <td style={tdStyle}>
                      <Badge text={volume.inUse ? 'in use' : 'unused'} color={volume.inUse ? 'var(--accent-yellow)' : 'var(--accent-green)'} />
                    </td>
                    <td style={tdStyle}>{volume.containers.length > 0 ? volume.containers.join(', ') : '-'}</td>
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
                        Delete
                      </button>
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
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px', background: `${color}20`, color }}>
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
