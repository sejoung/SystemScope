import { useEffect, useState } from 'react'
import type { SystemEvent } from '@shared/types'
import { formatBytes } from '@shared/utils/formatBytes'
import { useI18n } from '../../i18n/useI18n'
import { useCleanupStore } from '../../stores/useCleanupStore'
import { useToast } from '../../components/Toast'

export function AutomationHistoryCard() {
  const { tk } = useI18n()
  const executeCleanup = useCleanupStore((s) => s.executeCleanup)
  const executing = useCleanupStore((s) => s.executing)
  const showToast = useToast((s) => s.show)
  const [events, setEvents] = useState<SystemEvent[]>([])

  useEffect(() => {
    void loadHistory()
  }, [])

  async function loadHistory() {
    const res = await window.systemScope.getEventHistory({ category: 'system', limit: 20 })
    if (res.ok) {
      setEvents(
        (res.data ?? []).filter((event) => event.metadata?.kind === 'automation_cleanup')
      )
    }
  }

  async function handleRunNow() {
    const previewResult = await window.systemScope.previewCleanup()
    if (!previewResult.ok || !previewResult.data) {
      showToast(tk('Unable to run cleanup preview.'), 'danger')
      return
    }

    const safePaths = previewResult.data.items
      .filter((item) => ['npm_cache', 'pnpm_cache', 'yarn_cache', 'docker_stopped_containers', 'old_logs', 'temp_files'].includes(item.rule))
      .map((item) => item.path)

    if (safePaths.length === 0) {
      showToast(tk('No safe automation targets found.'), 'default')
      return
    }

    await executeCleanup(safePaths)
    await loadHistory()
    showToast(tk('Automation cleanup executed.'), 'success')
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>{tk('Automation History')}</div>
        <button
          type="button"
          onClick={() => void handleRunNow()}
          disabled={executing}
          style={runButtonStyle}
        >
          {executing ? tk('Running...') : tk('Run Now')}
        </button>
      </div>
      {events.length === 0 ? (
        <div style={emptyStyle}>
          <div style={mainTextStyle}>{tk('No automated cleanup runs yet.')}</div>
          <div style={subTextStyle}>{tk('Enable automation in Settings or run it once here to start building history.')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {events.slice(0, 6).map((event) => (
            <div key={event.id} style={rowStyle}>
              <div>
                <div style={mainTextStyle}>{event.title}</div>
                <div style={subTextStyle}>{new Date(event.ts).toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={mainTextStyle}>
                  {formatBytes(Number(event.metadata?.deletedSize ?? 0))}
                </div>
                <div style={subTextStyle}>
                  {tk('{count} deleted', { count: Number(event.metadata?.deletedCount ?? 0) })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '14px 16px',
  marginBottom: 16,
  borderRadius: 'var(--radius)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)'
}

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-primary)'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center'
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10
}

const mainTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-primary)'
}

const subTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)'
}

const emptyStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: '6px 0'
}

const runButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600
}
