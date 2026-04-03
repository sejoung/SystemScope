import { useSessionSnapshotStore } from '../../stores/useSessionSnapshotStore'
import { useI18n } from '../../i18n/useI18n'
import { formatBytes } from '@shared/utils/formatBytes'
import type { SnapshotDiffDelta } from '@shared/types'

function DeltaCell({ delta, isPercent, isBytes }: { delta: SnapshotDiffDelta; isPercent?: boolean; isBytes?: boolean }) {
  const sign = delta.delta > 0 ? '+' : ''
  const color = delta.delta > 0 ? 'var(--status-error, #e74c3c)' : delta.delta < 0 ? 'var(--status-success, #2ecc71)' : 'var(--text-secondary)'

  const fmt = (v: number) => {
    if (isBytes) return formatBytes(v)
    if (isPercent) return `${v.toFixed(1)}%`
    return v.toFixed(1)
  }

  return (
    <td style={{ padding: '4px 8px', fontSize: 12 }}>
      {fmt(delta.before)} → {fmt(delta.after)}{' '}
      <span style={{ color, fontWeight: 600 }}>
        ({sign}{isBytes ? formatBytes(delta.delta) : isPercent ? `${delta.delta.toFixed(1)}%` : delta.delta.toFixed(1)})
      </span>
    </td>
  )
}

export function SnapshotDiffView() {
  const { tk } = useI18n()
  const diff = useSessionSnapshotStore((s) => s.diff)
  const diffLoading = useSessionSnapshotStore((s) => s.diffLoading)

  if (diffLoading) return <p style={{ fontSize: 13 }}>{tk('Loading...')}</p>
  if (!diff) return null

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        {diff.snapshot1.label} vs {diff.snapshot2.label}
      </h4>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th scope="col" style={{ textAlign: 'left', padding: '4px 8px' }}>{tk('snapshot.diff.metric')}</th>
            <th scope="col" style={{ textAlign: 'left', padding: '4px 8px' }}>{tk('snapshot.diff.before')} → {tk('snapshot.diff.after')} ({tk('snapshot.diff.delta')})</th>
          </tr>
        </thead>
        <tbody>
          <tr><td scope="row" style={{ padding: '4px 8px' }}>{tk('CPU')}</td><DeltaCell delta={diff.system.cpuUsage} isPercent /></tr>
          <tr><td scope="row" style={{ padding: '4px 8px' }}>{tk('Memory')}</td><DeltaCell delta={diff.system.memoryUsage} isPercent /></tr>
          <tr><td scope="row" style={{ padding: '4px 8px' }}>{tk('Disk')}</td><DeltaCell delta={diff.system.diskUsage} isPercent /></tr>
          <tr><td scope="row" style={{ padding: '4px 8px' }}>{tk('Network')} ↓</td><DeltaCell delta={diff.system.networkRxSec} isBytes /></tr>
          <tr><td scope="row" style={{ padding: '4px 8px' }}>{tk('Network')} ↑</td><DeltaCell delta={diff.system.networkTxSec} isBytes /></tr>
        </tbody>
      </table>

      {(diff.processChanges.added.length > 0 || diff.processChanges.removed.length > 0 || diff.processChanges.changed.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          {diff.processChanges.added.length > 0 && (
            <p style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{tk('snapshot.diff.processes.added')}:</strong> {diff.processChanges.added.join(', ')}
            </p>
          )}
          {diff.processChanges.removed.length > 0 && (
            <p style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{tk('snapshot.diff.processes.removed')}:</strong> {diff.processChanges.removed.join(', ')}
            </p>
          )}
          {diff.processChanges.changed.length > 0 && (
            <div style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{tk('snapshot.diff.processes.changed')}:</strong>
              {diff.processChanges.changed.map((c) => (
                <span key={c.name} style={{ marginLeft: 8 }}>
                  {c.name} (CPU {c.cpuDelta > 0 ? '+' : ''}{c.cpuDelta.toFixed(1)}%, Mem {c.memoryDelta > 0 ? '+' : ''}{c.memoryDelta.toFixed(1)}%)
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {(diff.alertChanges.added.length > 0 || diff.alertChanges.removed.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          {diff.alertChanges.added.length > 0 && (
            <p style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{tk('snapshot.diff.alerts.added')}:</strong> {diff.alertChanges.added.join(', ')}
            </p>
          )}
          {diff.alertChanges.removed.length > 0 && (
            <p style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{tk('snapshot.diff.alerts.removed')}:</strong> {diff.alertChanges.removed.join(', ')}
            </p>
          )}
        </div>
      )}

      {diff.dockerDelta && (
        <div>
          <strong style={{ fontSize: 12 }}>{tk('snapshot.diff.docker')}:</strong>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
            <tbody>
              <tr><td scope="row" style={{ padding: '2px 8px' }}>{tk('Docker')} Images</td><DeltaCell delta={diff.dockerDelta.imagesCount} /></tr>
              <tr><td scope="row" style={{ padding: '2px 8px' }}>{tk('Docker')} Containers</td><DeltaCell delta={diff.dockerDelta.containersCount} /></tr>
              <tr><td scope="row" style={{ padding: '2px 8px' }}>{tk('Docker')} Volumes</td><DeltaCell delta={diff.dockerDelta.volumesCount} /></tr>
              <tr><td scope="row" style={{ padding: '2px 8px' }}>{tk('snapshot.diff.docker')} Size</td><DeltaCell delta={diff.dockerDelta.totalSize} isBytes /></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
