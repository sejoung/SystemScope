import { useCallback, useEffect, useState } from 'react'
import type { OrphanedLaunchAgent } from '@shared/types'
import { isOrphanedLaunchAgentArray } from '@shared/types/guards'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

/**
 * Lists user LaunchAgents whose target executable no longer exists (leftovers from
 * uninstalled apps) and lets the user move the stale .plist files to the Trash.
 * Renders nothing when there are none (e.g. non-macOS or a clean system).
 */
export function OrphanedLaunchAgents() {
  const { tk } = useI18n()
  const showToast = useToast((s) => s.show)
  const [orphans, setOrphans] = useState<OrphanedLaunchAgent[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  const scan = useCallback(async () => {
    try {
      const res = await window.systemScope.findOrphanedLaunchAgents()
      if (res.ok && isOrphanedLaunchAgentArray(res.data)) {
        setOrphans(res.data)
        setSelected(new Set(res.data.map((o) => o.id)))
      } else {
        setOrphans([])
      }
    } catch {
      setOrphans([])
    }
  }, [])

  useEffect(() => {
    void scan()
  }, [scan])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRemove = async () => {
    setConfirmOpen(false)
    if (selected.size === 0 || removing) return
    setRemoving(true)
    try {
      const res = await window.systemScope.removeOrphanedLaunchAgents([...selected])
      if (res.ok) {
        showToast(tk('startup.orphans.removed', { count: res.data.removedCount }), 'success')
        await scan()
      } else {
        showToast(res.error?.message ?? tk('startup.orphans.remove_failed'), 'danger')
      }
    } catch {
      showToast(tk('startup.orphans.remove_failed'), 'danger')
    } finally {
      setRemoving(false)
    }
  }

  // Nothing to surface (non-macOS, clean system, or still scanning the first time).
  if (orphans.length === 0) return null

  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h4 style={titleStyle}>{tk('startup.orphans.title', { count: orphans.length })}</h4>
          <p style={descStyle}>{tk('startup.orphans.description')}</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={selected.size === 0 || removing}
          style={{ ...trashBtnStyle, opacity: selected.size === 0 || removing ? 0.5 : 1 }}
        >
          {tk('startup.orphans.trash_selected', { count: selected.size })}
        </button>
      </div>

      <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {orphans.map((o) => (
          <li key={o.id} style={rowStyle}>
            <input
              type="checkbox"
              checked={selected.has(o.id)}
              onChange={() => toggle(o.id)}
              aria-label={o.label}
              style={{ marginTop: 3 }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={labelStyle}>{o.label}</div>
              <div style={metaStyle} title={o.missingExecutable}>
                {tk('startup.orphans.missing')}: {o.missingExecutable}
              </div>
              <div style={pathStyle} title={o.plistPath}>{o.plistPath}</div>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title={tk('startup.orphans.confirm_title')}
        message={tk('startup.orphans.confirm_message', { count: selected.size })}
        confirmLabel={tk('startup.orphans.confirm_ok')}
        cancelLabel={tk('Cancel')}
        onConfirm={handleRemove}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--accent-yellow)',
  borderRadius: 10,
  background: 'var(--bg-card)',
  padding: 16,
  marginBottom: 16,
}

const titleStyle: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }
const descStyle: React.CSSProperties = { margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const metaStyle: React.CSSProperties = { fontSize: 12, color: 'var(--accent-red)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }
const pathStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }
const trashBtnStyle: React.CSSProperties = {
  border: '1px solid var(--accent-red)',
  background: 'transparent',
  color: 'var(--accent-red)',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}
