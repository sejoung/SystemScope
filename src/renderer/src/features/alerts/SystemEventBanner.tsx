import { useEffect, useState } from 'react'
import type { SystemEvent } from '@shared/types'
import { formatBytes } from '@shared/utils/formatBytes'
import { useI18n } from '../../i18n/useI18n'

export function SystemEventBanner() {
  const { tk } = useI18n()
  const [events, setEvents] = useState<SystemEvent[]>([])

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

  if (events.length === 0) return null

  return (
    <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
      {events.slice(0, 2).map((event) => (
        <div key={event.id} style={bannerStyle}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{event.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {event.metadata?.kind === 'workspace_growth'
                ? tk('Growth: {size}', { size: formatBytes(Number(event.metadata?.growthBytes ?? 0)) })
                : tk('Reclaimed: {size}', { size: formatBytes(Number(event.metadata?.deletedSize ?? 0)) })}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(event.ts).toLocaleTimeString()}</div>
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
