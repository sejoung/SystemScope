import { useState } from 'react'
import { useSessionSnapshotStore } from '../../stores/useSessionSnapshotStore'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'

export function SnapshotButton() {
  const { t } = useI18n()
  const showToast = useToast((s) => s.show)
  const saveSnapshot = useSessionSnapshotStore((s) => s.saveSnapshot)
  const loading = useSessionSnapshotStore((s) => s.loading)
  const [showInput, setShowInput] = useState(false)
  const [label, setLabel] = useState('')

  const handleSave = async () => {
    const result = await saveSnapshot(label.trim() || undefined)
    if (result) {
      showToast(t('Snapshot saved.'), 'success')
      setLabel('')
      setShowInput(false)
    }
  }

  if (showInput) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          placeholder={t('Snapshot label')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
            fontSize: 12, width: 160,
          }}
        />
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            padding: '4px 10px', borderRadius: 6, border: 'none',
            backgroundColor: 'var(--accent-blue)', color: 'var(--text-on-accent)',
            cursor: 'pointer', fontSize: 12,
          }}
        >
          {loading ? t('Saving snapshot...') : t('Save Snapshot')}
        </button>
        <button
          onClick={() => { setShowInput(false); setLabel('') }}
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
            backgroundColor: 'transparent', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 12,
          }}
        >
          {t('Cancel')}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      title={t('Save current system state')}
      style={{
        padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
        cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      {t('Save Snapshot')}
    </button>
  )
}
