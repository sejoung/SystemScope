import { useState } from 'react'
import type { SystemEvent, SystemEventCategory, SystemEventSeverity } from '@shared/types'

function getCategoryIcon(category: SystemEventCategory): string {
  switch (category) {
    case 'alert':
      return '\u26A0'      // warning sign
    case 'disk_cleanup':
      return '\uD83D\uDDB4' // hard disk (fallback: use a simple symbol)
    case 'docker_cleanup':
      return '\uD83D\uDCE6' // package
    case 'app_removal':
      return '\uD83D\uDDD1' // wastebasket
    case 'settings_change':
      return '\u2699'       // gear
    case 'system':
      return '\uD83D\uDDA5' // desktop computer
    default:
      return '\u2022'       // bullet
  }
}

function getSeverityColor(severity: SystemEventSeverity): string {
  switch (severity) {
    case 'error':
      return 'var(--accent-red)'
    case 'warning':
      return 'var(--accent-yellow)'
    case 'info':
    default:
      return 'var(--accent-blue)'
  }
}

function formatRelativeTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

interface EventHistoryCardProps {
  event: SystemEvent
}

export function EventHistoryCard({ event }: EventHistoryCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        if (event.detail) setExpanded((prev) => !prev)
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '10px',
        alignItems: 'start',
        padding: '10px 12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        cursor: event.detail ? 'pointer' : 'default',
        width: '100%',
        textAlign: 'left',
        fontSize: '13px',
        color: 'var(--text-primary)',
      }}
    >
      {/* Icon + severity dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '1px' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: getSeverityColor(event.severity),
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: '14px', lineHeight: 1 }}>
          {getCategoryIcon(event.category)}
        </span>
      </div>

      {/* Title + detail */}
      <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
        <span
          style={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: expanded ? 'normal' : 'nowrap',
          }}
        >
          {event.title}
        </span>
        {expanded && event.detail ? (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {event.detail}
          </span>
        ) : null}
      </div>

      {/* Relative time */}
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          paddingTop: '2px',
        }}
      >
        {formatRelativeTime(event.ts)}
      </span>
    </button>
  )
}
