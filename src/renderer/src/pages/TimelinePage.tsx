import { useEffect, useState } from 'react'
import { useTimelineStore } from '../stores/useTimelineStore'
import { useEventStore } from '../stores/useEventStore'
import { TimelineChart } from '../features/timeline/TimelineChart'
import { EventHistoryCard } from '../features/timeline/EventHistoryCard'
import { PointDetailPanel } from '../features/timeline/PointDetailPanel'
import { AlertIntelligencePanel } from '../features/timeline/AlertIntelligencePanel'
import { SnapshotList } from '../features/sessionSnapshot/SnapshotList'
import { SnapshotDiffView } from '../features/sessionSnapshot/SnapshotDiffView'
import { PageTab } from '../components/PageTab'
import { PageLoading } from '../components/PageLoading'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useI18n } from '../i18n/useI18n'
import { isAlertIntelligence } from '@shared/types'
import type { TimelineRange, AlertIntelligence } from '@shared/types'
import type { SystemEventCategory } from '@shared/types'
import { useContainerWidth } from '../hooks/useContainerWidth'

const RANGE_OPTIONS: { value: TimelineRange; labelKey: 'timeline.range.24h' | 'timeline.range.7d' | 'timeline.range.30d' }[] = [
  { value: '24h', labelKey: 'timeline.range.24h' },
  { value: '7d', labelKey: 'timeline.range.7d' },
  { value: '30d', labelKey: 'timeline.range.30d' },
]

const EVENT_FILTER_OPTIONS: { value: SystemEventCategory | null; labelKey: string }[] = [
  { value: null, labelKey: 'timeline.events.filter.all' },
  { value: 'alert', labelKey: 'timeline.events.filter.alert' },
  { value: 'disk_cleanup', labelKey: 'timeline.events.filter.disk_cleanup' },
  { value: 'docker_cleanup', labelKey: 'timeline.events.filter.docker_cleanup' },
  { value: 'app_removal', labelKey: 'timeline.events.filter.app_removal' },
  { value: 'system', labelKey: 'timeline.events.filter.system' },
]

export function TimelinePage() {
  const [containerRef, containerWidth] = useContainerWidth(1280)
  const range = useTimelineStore((s) => s.range)
  const setRange = useTimelineStore((s) => s.setRange)
  const data = useTimelineStore((s) => s.data)
  const loading = useTimelineStore((s) => s.loading)
  const error = useTimelineStore((s) => s.error)
  const fetchTimeline = useTimelineStore((s) => s.fetchTimeline)

  const events = useEventStore((s) => s.events)
  const eventsLoading = useEventStore((s) => s.loading)
  const eventFilter = useEventStore((s) => s.filter)
  const setFilter = useEventStore((s) => s.setFilter)
  const fetchEvents = useEventStore((s) => s.fetchEvents)
  const fetchFilteredEvents = useEventStore((s) => s.fetchFilteredEvents)
  const clearEventHistory = useEventStore((s) => s.clearEventHistory)

  const [intelligence, setIntelligence] = useState<AlertIntelligence | null>(null)
  const [intelligenceLoading, setIntelligenceLoading] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  const { tk } = useI18n()
  const showToast = useToast((s) => s.show)
  const useStackedLowerLayout = containerWidth < 1180

  // Fetch alert intelligence on mount
  useEffect(() => {
    let cancelled = false
    setIntelligenceLoading(true)
    window.systemScope
      .getAlertIntelligence()
      .then((result) => {
        if (!cancelled && result.ok && isAlertIntelligence(result.data)) {
          setIntelligence(result.data)
        }
      })
      .catch(() => {
        // silently ignore — panel will show empty state
      })
      .finally(() => {
        if (!cancelled) setIntelligenceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch timeline data when range changes
  useEffect(() => {
    void fetchTimeline()
  }, [range, fetchTimeline])

  // Fetch events when filter changes
  useEffect(() => {
    if (eventFilter) {
      void fetchFilteredEvents(eventFilter)
    } else {
      void fetchEvents()
    }
  }, [eventFilter, fetchEvents, fetchFilteredEvents])

  const handleConfirmClearHistory = async () => {
    const clearedCount = await clearEventHistory()
    setConfirmClearOpen(false)

    if (clearedCount === null) {
      showToast(tk('timeline.events.clear_failed'), 'danger')
      return
    }

    showToast(
      tk('timeline.events.cleared', { count: clearedCount }),
      'success',
    )
  }

  return (
    <div data-testid="page-timeline" ref={containerRef}>
      {/* Header */}
      <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
            {tk('timeline.page.title')}
          </h2>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            {tk('timeline.page.description')}
          </div>
        </div>

        {/* Range selector */}
        <div
          role="tablist"
          aria-label={tk('timeline.page.title')}
          style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '3px',
          }}
        >
          {RANGE_OPTIONS.map((opt) => (
            <PageTab
              key={opt.value}
              id={`timeline-range-${opt.value}`}
              active={range === opt.value}
              onClick={() => setRange(opt.value)}
            >
              {tk(opt.labelKey)}
            </PageTab>
          ))}
        </div>
      </div>

      {/* Timeline Chart Section */}
      <div style={{ marginBottom: '16px' }}>
        <ErrorBoundary title={tk('timeline.page.title')}>
          {loading ? (
            <PageLoading message={tk('timeline.loading')} />
          ) : error ? (
            <div style={errorBoxStyle}>
              <span style={{ fontSize: '13px', color: 'var(--accent-red)' }}>{tk(error)}</span>
            </div>
          ) : data ? (
            <TimelineChart data={data} />
          ) : (
            <div style={emptyBoxStyle}>{tk('timeline.empty')}</div>
          )}
        </ErrorBoundary>
      </div>

      {/* Point Detail Panel */}
      <div style={{ marginBottom: '16px' }}>
        <ErrorBoundary title={tk('timeline.point_detail.title')}>
          <PointDetailPanel />
        </ErrorBoundary>
      </div>

      {/* Alert Intelligence */}
      <div style={{ marginBottom: '16px' }}>
        <ErrorBoundary title={tk('alert.intelligence.title')}>
          <AlertIntelligencePanel intelligence={intelligence} loading={intelligenceLoading} />
        </ErrorBoundary>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: useStackedLowerLayout ? '1fr' : 'minmax(0, 1.6fr) minmax(320px, 0.9fr)',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        <ErrorBoundary title={tk('timeline.events.title')}>
          <div
            style={{
              padding: '16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              order: useStackedLowerLayout ? 2 : 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '12px',
                flexWrap: 'wrap',
              }}
            >
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text-primary)',
                }}
              >
                {tk('timeline.events.title')}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                disabled={eventsLoading || events.length === 0}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: eventsLoading || events.length === 0 ? 'var(--bg-card-hover)' : 'var(--accent-red)',
                  color: eventsLoading || events.length === 0 ? 'var(--text-muted)' : 'var(--text-on-accent)',
                  cursor: eventsLoading || events.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {tk('timeline.events.clear')}
              </button>
            </div>

            <div
              role="tablist"
              aria-label={tk('timeline.events.title')}
              style={{
                display: 'flex',
                gap: '4px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '3px',
                marginBottom: '12px',
                flexWrap: 'wrap',
              }}
            >
              {EVENT_FILTER_OPTIONS.map((opt) => (
                <PageTab
                  key={opt.value ?? 'all'}
                  id={`event-filter-${opt.value ?? 'all'}`}
                  active={eventFilter === opt.value}
                  onClick={() => setFilter(opt.value)}
                >
                  {tk(opt.labelKey as Parameters<typeof tk>[0])}
                </PageTab>
              ))}
            </div>

            {eventsLoading ? (
              <div style={emptyBoxStyle}>{tk('timeline.loading')}</div>
            ) : events.length === 0 ? (
              <div style={emptyBoxStyle}>{tk('timeline.events.empty')}</div>
            ) : (
              <div style={{ display: 'grid', gap: '6px' }}>
                {events.map((event) => (
                  <EventHistoryCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </ErrorBoundary>

        <ErrorBoundary title={tk('Snapshots')}>
          <div
            style={{
              padding: '16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              position: useStackedLowerLayout ? 'static' : 'sticky',
              top: useStackedLowerLayout ? undefined : '16px',
              order: useStackedLowerLayout ? 1 : 2,
            }}
          >
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 700,
                margin: '0 0 12px 0',
                color: 'var(--text-primary)',
              }}
            >
              {tk('Snapshots')}
            </h3>
            <SnapshotList />
            <SnapshotDiffView />
          </div>
        </ErrorBoundary>
      </div>

      <ConfirmDialog
        open={confirmClearOpen}
        title={tk('timeline.events.clear_confirm_title')}
        message={tk('timeline.events.clear_confirm_message')}
        confirmLabel={tk('timeline.events.clear')}
        cancelLabel={tk('common.cancel')}
        tone="danger"
        details={tk('timeline.events.clear_confirm_detail')}
        onConfirm={() => {
          void handleConfirmClearHistory()
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  )
}

const errorBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '200px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}

const emptyBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '120px',
  color: 'var(--text-muted)',
  fontSize: '13px',
}
