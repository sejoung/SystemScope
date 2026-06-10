import { useCallback, useEffect, useState } from 'react'
import type { OrphanedLaunchAgent, OrphanedLaunchAgentReason } from '@shared/types'
import type { TranslationKey } from '@shared/i18n'
import { isOrphanedLaunchAgentArray } from '@shared/types/guards'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useStartupStore } from '../../stores/apps/useStartupStore'

/**
 * Lists LaunchAgents/LaunchDaemons whose target no longer exists (leftovers from
 * uninstalled apps) and lets the user move the stale .plist files to the Trash.
 * System-scope items trigger a single macOS administrator password prompt.
 * Renders nothing when there are none (e.g. non-macOS or a clean system).
 */
export function OrphanedLaunchAgents() {
  const { tk } = useI18n()
  const showToast = useToast((s) => s.show)
  const fetchStartupItems = useStartupStore((s) => s.fetchItems)
  const [orphans, setOrphans] = useState<OrphanedLaunchAgent[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  const scan = useCallback(async () => {
    try {
      const res = await window.systemScope.findOrphanedLaunchAgents()
      if (res.ok && isOrphanedLaunchAgentArray(res.data)) {
        setOrphans(res.data)
        // Pre-select only the high-confidence orphans; "associated app missing"
        // entries are a heuristic, so the user opts in per item.
        setSelected(new Set(res.data.filter((o) => o.reason !== 'missing_app').map((o) => o.id)))
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
        const { removedCount, failedCount, errors } = res.data
        if (failedCount > 0) {
          showToast(
            tk('startup.orphans.remove_partial', { removed: removedCount, failed: failedCount, error: errors[0] ?? '' }),
            'danger'
          )
        } else {
          showToast(tk('startup.orphans.removed', { count: removedCount }), 'success')
        }
        await scan()
        // The startup-items list below shows the same plists — refresh it too.
        if (removedCount > 0) void fetchStartupItems()
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

  const removingSystemItems = orphans.some((o) => selected.has(o.id) && o.scope === 'system')
  const confirmMessage = removingSystemItems
    ? `${tk('startup.orphans.confirm_message', { count: selected.size })} ${tk('startup.orphans.admin_required')}`
    : tk('startup.orphans.confirm_message', { count: selected.size })

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div style={labelStyle}>{o.label}</div>
                <span style={o.scope === 'system' ? systemBadgeStyle : userBadgeStyle}>
                  {tk(o.scope === 'system' ? 'startup.orphans.scope_system' : 'startup.orphans.scope_user')}
                </span>
              </div>
              <div style={metaStyle} title={o.missingExecutable}>
                {tk(REASON_KEYS[o.reason])}: {o.missingExecutable}
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
        message={confirmMessage}
        confirmLabel={tk('startup.orphans.confirm_ok')}
        cancelLabel={tk('Cancel')}
        onConfirm={handleRemove}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}

const REASON_KEYS = {
  missing_executable: 'startup.orphans.missing',
  broken_symlink: 'startup.orphans.broken_link',
  missing_app: 'startup.orphans.missing_app',
} as const satisfies Record<OrphanedLaunchAgentReason, TranslationKey>

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
const badgeBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, flexShrink: 0, textTransform: 'uppercase' }
const userBadgeStyle: React.CSSProperties = { ...badgeBase, color: 'var(--text-secondary)', border: '1px solid var(--border)' }
const systemBadgeStyle: React.CSSProperties = { ...badgeBase, color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)' }
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
