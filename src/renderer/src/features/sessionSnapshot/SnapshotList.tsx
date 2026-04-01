import { useEffect } from 'react'
import { useSessionSnapshotStore } from '../../stores/useSessionSnapshotStore'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'

export function SnapshotList() {
  const { t } = useI18n()
  const showToast = useToast((s) => s.show)
  const snapshots = useSessionSnapshotStore((s) => s.snapshots)
  const loading = useSessionSnapshotStore((s) => s.loading)
  const selectedIds = useSessionSnapshotStore((s) => s.selectedIds)
  const fetchSnapshots = useSessionSnapshotStore((s) => s.fetchSnapshots)
  const deleteSnapshot = useSessionSnapshotStore((s) => s.deleteSnapshot)
  const toggleSelection = useSessionSnapshotStore((s) => s.toggleSelection)
  const computeDiff = useSessionSnapshotStore((s) => s.computeDiff)

  useEffect(() => { fetchSnapshots() }, [fetchSnapshots])

  const handleDelete = async (id: string) => {
    const ok = await deleteSnapshot(id)
    if (ok) showToast(t('Snapshot deleted.'), 'success')
  }

  const handleCompare = () => {
    if (selectedIds.length === 2) computeDiff()
  }

  if (loading && snapshots.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('Loading...')}</p>
  }

  if (snapshots.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('No snapshots saved yet.')}</p>
  }

  return (
    <div>
      {selectedIds.length === 2 && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={handleCompare}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              backgroundColor: 'var(--accent-blue)', color: 'var(--text-on-accent)',
              cursor: 'pointer', fontSize: 13,
            }}
          >
            {t('Compare snapshots')}
          </button>
        </div>
      )}

      {selectedIds.length < 2 && snapshots.length >= 2 && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          {t('Select two snapshots to compare.')}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {snapshots.map((snap) => {
          const isSelected = selectedIds.includes(snap.id)
          return (
            <div
              key={snap.id}
              onClick={() => toggleSelection(snap.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8,
                border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                cursor: 'pointer', fontSize: 13, transition: 'border 0.15s',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{snap.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {new Date(snap.timestamp).toLocaleString()} — CPU {snap.system.cpuUsage.toFixed(0)}% | Mem {snap.system.memoryUsage.toFixed(0)}% | Disk {snap.system.diskUsage.toFixed(0)}%
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(snap.id) }}
                title={t('Delete snapshot')}
                style={{
                  padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)',
                  backgroundColor: 'transparent', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 11,
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
