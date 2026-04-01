import { useState, useMemo } from 'react'
import { useDevToolsStore } from '../../stores/useDevToolsStore'
import { useI18n } from '../../i18n/useI18n'
import { formatBytes } from '@shared/utils/formatBytes'
import type { ReclaimableItem, SafetyLevel } from '@shared/types'

const SAFETY_COLORS: Record<SafetyLevel, string> = {
  safe: 'var(--accent-green)',
  caution: 'var(--accent-yellow)',
  risky: 'var(--accent-red)'
}

export function DevToolsDetailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tk } = useI18n()
  const results = useDevToolsStore((s) => s.results)
  const cleaning = useDevToolsStore((s) => s.cleaning)
  const cleanItems = useDevToolsStore((s) => s.cleanItems)
  const scan = useDevToolsStore((s) => s.scan)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [doneMessage, setDoneMessage] = useState<string | null>(null)

  const allReclaimable = useMemo(() => results.flatMap((r) => r.reclaimable), [results])

  if (!open) return null

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const handleClean = async () => {
    const paths = allReclaimable.filter((item) => selected.has(item.id) && item.path).map((item) => item.path)
    if (paths.length === 0) return
    const result = await cleanItems(paths)
    if (result) {
      setDoneMessage(`Done — ${result.succeeded.length} cleaned, ${result.failed.length} failed`)
      setSelected(new Set())
      void scan()
    }
  }

  const selectedSize = allReclaimable.filter((item) => selected.has(item.id)).reduce((sum, item) => sum + item.size, 0)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{tk('devtools.detail.title')}</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 6px' }}>x</button>
          </div>
          {doneMessage && <div style={{ fontSize: 12, color: 'var(--accent-green)', marginTop: 6 }}>{doneMessage}</div>}
        </div>

        <div style={{ padding: '10px 20px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setSelected(new Set(allReclaimable.map((i) => i.id)))} style={ctrlBtn}>{tk('devtools.detail.select_all')}</button>
          <button onClick={() => setSelected(new Set())} style={ctrlBtn}>{tk('devtools.detail.deselect_all')}</button>
          <div style={{ flex: 1 }} />
          {selected.size > 0 && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{selected.size} items ({formatBytes(selectedSize)})</span>}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px' }}>
          {allReclaimable.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>{tk('devtools.detail.empty')}</div>
          ) : allReclaimable.map((item) => (
            <ReclaimableRow key={item.id} item={item} checked={selected.has(item.id)} onToggle={() => toggleItem(item.id)} />
          ))}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ctrlBtn}>Close</button>
          <button onClick={() => void handleClean()} disabled={selected.size === 0 || cleaning} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 'var(--radius)', border: 'none',
            background: selected.size > 0 && !cleaning ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: selected.size > 0 && !cleaning ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
            cursor: selected.size > 0 && !cleaning ? 'pointer' : 'not-allowed'
          }}>{cleaning ? tk('devtools.detail.cleaning') : tk('devtools.detail.clean_selected')}</button>
        </div>
      </div>
    </div>
  )
}

function ReclaimableRow({ item, checked, onToggle }: { item: ReclaimableItem; checked: boolean; onToggle: () => void }) {
  const { tk } = useI18n()
  const safetyColor = SAFETY_COLORS[item.safetyLevel]
  const safetyLabel = item.safetyLevel === 'safe' ? tk('devtools.safety.safe')
    : item.safetyLevel === 'caution' ? tk('devtools.safety.caution') : tk('devtools.safety.risky')

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid color-mix(in srgb, var(--border) 40%, transparent)', cursor: 'pointer', fontSize: 12 }}>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.path}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: safetyColor, flexShrink: 0 }}>{safetyLabel}</span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>{formatBytes(item.size)}</span>
    </label>
  )
}

const ctrlBtn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer'
}
