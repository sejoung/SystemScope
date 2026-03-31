import { useEffect, useState } from 'react'
import { useTimelineStore } from '../stores/useTimelineStore'
import { useEventStore } from '../stores/useEventStore'
import { TimelineChart } from '../features/timeline/TimelineChart'
import { EventHistoryCard } from '../features/timeline/EventHistoryCard'
import { PointDetailPanel } from '../features/timeline/PointDetailPanel'
import { AlertIntelligencePanel } from '../features/timeline/AlertIntelligencePanel'
import { PageTab } from '../components/PageTab'
import { PageLoading } from '../components/PageLoading'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useI18n } from '../i18n/useI18n'
import { isAlertIntelligence } from '@shared/types'
import type { TimelineRange, AlertIntelligence } from '@shared/types'
import type { SystemEventCategory } from '@shared/types'

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

  const [intelligence, setIntelligence] = useState<AlertIntelligence | null>(null)
  const [intelligenceLoading, setIntelligenceLoading] = useState(false)

  const { tk } = useI18n()

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

  return (
    <div data-testid="page-timeline">
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
              <span style={{ fontSize: '13px', color: 'var(--accent-red)' }}>{error}</span>
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

      {/* Event History Section */}
      <ErrorBoundary title={tk('timeline.events.title')}>
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
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
            {tk('timeline.events.title')}
          </h3>

          {/* Event filter tabs */}
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

          {/* Event list */}
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
