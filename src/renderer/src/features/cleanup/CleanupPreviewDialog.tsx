import { useState } from 'react'
import type { CleanupPreview } from '@shared/types'
import { formatBytes } from '@shared/utils/formatBytes'
import { useCleanupStore } from '../../stores/useCleanupStore'
import { useI18n } from '../../i18n/useI18n'
import { ConfirmDialog } from '../../components/ConfirmDialog'

interface CleanupPreviewDialogProps {
  preview: CleanupPreview
  onClose: () => void
}

export function CleanupPreviewDialog({ preview, onClose }: CleanupPreviewDialogProps) {
  const executeCleanup = useCleanupStore((s) => s.executeCleanup)
  const fetchInbox = useCleanupStore((s) => s.fetchInbox)
  const executing = useCleanupStore((s) => s.executing)
  const { tk, t } = useI18n()

  const [selected, setSelected] = useState<Set<string>>(() => new Set(preview.items.map((i) => i.path)))
  const [confirmOpen, setConfirmOpen] = useState(false)

  const toggleItem = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === preview.items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(preview.items.map((i) => i.path)))
    }
  }

  const selectedSize = preview.items
    .filter((i) => selected.has(i.path))
    .reduce((sum, i) => sum + i.size, 0)

  const handleClean = () => {
    if (selected.size === 0) return
    setConfirmOpen(true)
  }

  const handleConfirmClean = async () => {
    setConfirmOpen(false)
    await executeCleanup(Array.from(selected))
    await fetchInbox()
    onClose()
  }

  return (
    <>
      <div style={overlayStyle} role="presentation" onClick={onClose}>
        <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {tk('cleanup.preview.title')}
            </h3>
            <button type="button" onClick={onClose} style={closeBtnStyle} aria-label={t('Cancel')}>
              &times;
            </button>
          </div>

          {/* Rule breakdown */}
          {preview.ruleBreakdown.length > 0 && (
            <div style={{ display: 'grid', gap: '4px' }}>
              <div style={tableHeaderStyle}>
                <span style={{ flex: 2 }}>{t('Rule')}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{t('Items')}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{t('Size')}</span>
              </div>
              {preview.ruleBreakdown.map((rb) => (
                <div key={rb.ruleId} style={tableRowStyle}>
                  <span style={{ flex: 2, fontSize: '13px', color: 'var(--text-primary)' }}>{t(rb.ruleName)}</span>
                  <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>{rb.itemCount}</span>
                  <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>{formatBytes(rb.totalSize)}</span>
                </div>
              ))}
              <div style={{ ...tableRowStyle, borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <span style={{ flex: 2, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {tk('cleanup.preview.total')}
                </span>
                <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {preview.items.length}
                </span>
                <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {formatBytes(preview.totalSize)}
                </span>
              </div>
            </div>
          )}

          {/* Item list with checkboxes */}
          <div style={itemListStyle}>
            {preview.items.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected.size === preview.items.length}
                  onChange={toggleAll}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('Select all')} ({preview.items.length})
                </span>
              </label>
            )}
            {preview.items.map((item) => (
              <label key={item.path} style={itemRowStyle}>
                <input
                  type="checkbox"
                  checked={selected.has(item.path)}
                  onChange={() => toggleItem(item.path)}
                />
                <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>
                  {item.path}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatBytes(item.size)}
                </span>
              </label>
            ))}
            {preview.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                {tk('cleanup.preview.empty')}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {t('{count} selected', { count: selected.size })} &middot; {formatBytes(selectedSize)}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={onClose} style={cancelBtnStyle}>
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleClean}
                disabled={selected.size === 0 || executing}
                style={{
                  ...cleanBtnStyle,
                  opacity: selected.size === 0 || executing ? 0.5 : 1,
                }}
              >
                {executing ? t('Cleaning...') : t('Clean Selected')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={tk('cleanup.execute.confirm')}
        message={t('This will permanently remove {count} items ({size}).', {
          count: selected.size,
          size: formatBytes(selectedSize),
        })}
        confirmLabel={t('Clean')}
        cancelLabel={t('Cancel')}
        tone="danger"
        onConfirm={() => void handleConfirmClean()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  background: 'rgba(15, 23, 42, 0.5)',
  backdropFilter: 'blur(6px)',
  zIndex: 10000,
}

const dialogStyle: React.CSSProperties = {
  width: 'min(100%, 640px)',
  maxHeight: '80vh',
  display: 'grid',
  gap: '16px',
  padding: '20px',
  borderRadius: '16px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-lg)',
  overflow: 'hidden',
}

const closeBtnStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  fontWeight: 700,
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
}

const tableHeaderStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  padding: '6px 0',
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)',
}

const tableRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  padding: '4px 0',
}

const itemListStyle: React.CSSProperties = {
  maxHeight: '300px',
  overflowY: 'auto',
  display: 'grid',
  gap: '2px',
}

const itemRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '4px 0',
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 600,
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-primary)',
  cursor: 'pointer',
}

const cleanBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 700,
  borderRadius: '8px',
  border: 'none',
  background: 'var(--accent-red)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer',
}
