import { thStyle, tdStyle, actionBtnStyle, rowStyle } from './DockerContainers.styles'
import { Accordion } from '../../components/ui/Accordion'
import { formatBytes } from '../../utils/format'
import { CopyableValue } from '../../components/ui/CopyableValue'
import { CompactMetaItem, compactActionsStyle, compactCardHeaderStyle, compactCardStyle, compactListStyle, compactMetaGridStyle } from '../../components/ui/CompactPrimitives'

export { shouldUseDockerContainersCompactLayout } from "./useDockerContainersModel"
import { useDockerContainersModel } from "./useDockerContainersModel"

export function DockerContainers({ refreshToken = 0, onChanged, onOpenImages }: { refreshToken?: number; onChanged?: () => void; onOpenImages?: () => void }) {
  const { containerRef, tk, loading, containers, status, message, selectedIds, setSelectedIds, removableContainers, runningContainers, selectedRemovableCount, allRemovableChecked, compactLayout, scanContainers, handleDelete, handleStop } = useDockerContainersModel(refreshToken, onChanged)

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
        <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
          {compactLayout ? (
            <div style={compactListStyle}>
              {containers.map((container) => (
                <div key={container.id} style={compactCardStyle}>
                  <div style={compactCardHeaderStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{container.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>{container.shortId}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Badge text={container.running ? tk('docker.containers.running') : tk('docker.containers.stopped_label')} color={container.running ? 'var(--accent-yellow)' : 'var(--accent-green)'} />
                    </div>
                  </div>
                  <div style={compactMetaGridStyle}>
                    <CompactMetaItem label={tk('docker.containers.table.image')} value={container.image} />
                    <CompactMetaItem label={tk('docker.containers.table.ports')} value={container.ports || '-'} mono />
                    <CompactMetaItem label={tk('docker.containers.table.writable')} value={formatBytes(container.sizeBytes)} mono />
                    <CompactMetaItem label={tk('docker.containers.table.status')} value={container.status} muted multiline />
                  </div>
                  {container.command ? (
                    <CopyableValue value={container.command} fontSize="12px" color="var(--text-muted)" multiline maxWidth="100%" />
                  ) : null}
                  <div style={compactActionsStyle}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
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
                      Select
                    </label>
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

