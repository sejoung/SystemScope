import { useEffect, useMemo, useState } from 'react'
import type { SystemEvent } from '@shared/types'
import { formatBytes } from '@shared/utils/formatBytes'
import { useI18n } from '../../i18n/useI18n'

const DISMISSED_STORAGE_KEY = 'systemscope.dismissedEventBannerIds'
const MAX_DISMISSED_TRACKED = 200

function getSafeLocalStorage(): Storage | undefined {
  try {
    if (typeof globalThis === 'undefined') return undefined
    const storage = (globalThis as { localStorage?: Storage }).localStorage
    return storage ?? undefined
  } catch {
    return undefined
  }
}

function loadDismissedIds(): string[] {
  try {
    const raw = getSafeLocalStorage()?.getItem(DISMISSED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function saveDismissedIds(ids: string[]): void {
  try {
    const trimmed = ids.slice(-MAX_DISMISSED_TRACKED)
    getSafeLocalStorage()?.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Ignore storage failures and keep in-memory state.
  }
}

export function SystemEventBanner() {
  const { tk } = useI18n()
  const [events, setEvents] = useState<SystemEvent[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => loadDismissedIds())

  useEffect(() => {
    void window.systemScope.getEventHistory({ category: 'system', limit: 10 }).then((res) => {
      if (res.ok) {
        setEvents(
          (res.data ?? []).filter((event) =>
            event.metadata?.kind === 'automation_cleanup' || event.metadata?.kind === 'workspace_growth'
          )
        )
      }
    })
  }, [])

  const visibleEvents = useMemo(() => {
    const dismissedSet = new Set(dismissedIds)
    return events.filter((event) => !dismissedSet.has(event.id))
  }, [events, dismissedIds])

  function dismissEvent(id: string): void {
    setDismissedIds((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      saveDismissedIds(next)
      return next
    })
  }

  if (visibleEvents.length === 0) return null

  return (
    <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
      {visibleEvents.slice(0, 2).map((event) => (
        <div key={event.id} style={bannerStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{event.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {event.metadata?.kind === 'workspace_growth'
                ? tk('Growth: {size}', { size: formatBytes(Number(event.metadata?.growthBytes ?? 0)) })
                : tk('Reclaimed: {size}', { size: formatBytes(Number(event.metadata?.deletedSize ?? 0)) })}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(event.ts).toLocaleTimeString()}</div>
          <button
            type="button"
            aria-label={tk('Close')}
            title={tk('Close')}
            onClick={() => dismissEvent(event.id)}
            style={closeButtonStyle}
          >
            x
          </button>
        </div>
      ))}
    </div>
  )
}

const bannerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 'var(--radius)',
  background: 'color-mix(in srgb, var(--accent-blue) 10%, var(--bg-card))',
  border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, var(--border))'
}

const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 16,
  padding: '0 4px',
  lineHeight: 1
}
