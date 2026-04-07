import { useEffect, useMemo, useState } from 'react'
import { formatBytes } from '@shared/utils/formatBytes'
import type { NetworkFlowSummary } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../../hooks/useResponsiveLayout'
import { useNetworkCaptureStore } from '../../stores/useNetworkCaptureStore'

type DetailTab = 'headers' | 'cookies' | 'payload' | 'response' | 'timing'
type ProtocolFilter = 'all' | 'http' | 'https' | 'dns' | 'tcp' | 'udp' | 'ws'

export function shouldUseNetworkCaptureSingleColumnLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.devToolsNetworkCaptureSingleColumn)
}

export function NetworkCapturePanel() {
  const { tk } = useI18n()
  const [containerRef, containerWidth] = useContainerWidth(1200)
  const capability = useNetworkCaptureStore((s) => s.capability)
  const status = useNetworkCaptureStore((s) => s.status)
  const recentFlows = useNetworkCaptureStore((s) => s.recentFlows)
  const selectedFlowId = useNetworkCaptureStore((s) => s.selectedFlowId)
  const loading = useNetworkCaptureStore((s) => s.loading)
  const error = useNetworkCaptureStore((s) => s.error)
  const connect = useNetworkCaptureStore((s) => s.connect)
  const disconnect = useNetworkCaptureStore((s) => s.disconnect)
  const selectFlow = useNetworkCaptureStore((s) => s.selectFlow)
  const startCapture = useNetworkCaptureStore((s) => s.startCapture)
  const stopCapture = useNetworkCaptureStore((s) => s.stopCapture)
  const clearCapture = useNetworkCaptureStore((s) => s.clearCapture)

  const [search, setSearch] = useState('')
  const [protocolFilter, setProtocolFilter] = useState<ProtocolFilter>('all')
  const [onlyActive, setOnlyActive] = useState(false)
  const [preserveLog, setPreserveLog] = useState(true)
  const [detailTab, setDetailTab] = useState<DetailTab>('headers')

  const singleColumnLayout = shouldUseNetworkCaptureSingleColumnLayout(containerWidth)

  useEffect(() => {
    void connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  const filteredFlows = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase()
    return recentFlows.filter((flow) => {
      if (onlyActive && flow.status !== 'open') return false
      if (protocolFilter !== 'all' && flow.protocol !== protocolFilter) return false
      if (!normalizedQuery) return true

      const haystack = [
        flow.processName ?? '',
        flow.host ?? '',
        flow.ip ?? '',
        flow.protocol,
        flow.status,
      ].join(' ').toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [onlyActive, protocolFilter, recentFlows, search])

  const selectedFlow = useMemo(
    () => filteredFlows.find((flow) => flow.id === selectedFlowId) ?? filteredFlows[0] ?? null,
    [filteredFlows, selectedFlowId]
  )

  async function handleToggleRecording(): Promise<void> {
    if (status?.running) {
      await stopCapture()
      return
    }

    if (!preserveLog && recentFlows.length > 0) {
      await clearCapture()
    }

    await startCapture()
  }

  const waterfallMetrics = useMemo(() => {
    if (filteredFlows.length === 0) {
      return { minStart: 0, maxEnd: 0, totalDuration: 1 }
    }

    const minStart = Math.min(...filteredFlows.map((flow) => flow.startedAt))
    const maxEnd = Math.max(...filteredFlows.map((flow) => flow.endedAt ?? Date.now()))
    return {
      minStart,
      maxEnd,
      totalDuration: Math.max(maxEnd - minStart, 1),
    }
  }, [filteredFlows])

  return (
    <section ref={containerRef} style={rootStyle}>
      <div style={shellStyle}>
        <div style={toolbarStyle}>
          <div style={toolbarLeftStyle}>
            <button
              type="button"
              onClick={() => void handleToggleRecording()}
              disabled={!capability?.supported}
              style={{
                ...recordButtonStyle,
                opacity: !capability?.supported ? 0.45 : 1,
                cursor: !capability?.supported ? 'default' : 'pointer',
              }}
            >
              <span style={{ ...recordDotStyle, background: status?.running ? '#ef4444' : 'var(--text-muted)' }} />
              {status?.running ? tk('Recording') : tk('Record')}
            </button>
            <button
              type="button"
              onClick={() => void clearCapture()}
              disabled={recentFlows.length === 0}
              style={{
                ...toolbarButtonStyle,
                opacity: recentFlows.length === 0 ? 0.45 : 1,
                cursor: recentFlows.length === 0 ? 'default' : 'pointer',
              }}
            >
              {tk('Clear')}
            </button>
            <ToolbarToggle label={tk('Preserve log')} active={preserveLog} onClick={() => setPreserveLog((value) => !value)} />
            <ToolbarToggle label={tk('Only active')} active={onlyActive} onClick={() => setOnlyActive((value) => !value)} />
            <StatusBadge capabilitySupported={Boolean(capability?.supported)} running={Boolean(status?.running)} />
          </div>

          <div style={toolbarRightStyle}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tk('Filter flows')}
              style={searchInputStyle}
            />
            <select value={protocolFilter} onChange={(event) => setProtocolFilter(event.target.value as ProtocolFilter)} style={selectStyle}>
              <option value="all">{tk('All Types')}</option>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="dns">DNS</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="ws">WS</option>
            </select>
          </div>
        </div>

        <div style={summaryBarStyle}>
          <SummaryChip label={tk('Mode')} value={capability?.mode === 'metadata' ? tk('Metadata') : tk('Unavailable')} />
          <SummaryChip label={tk('Platform')} value={capability?.platform ?? tk('Unknown')} />
          <SummaryChip label={tk('Flows')} value={String(filteredFlows.length)} />
          <SummaryChip label={tk('Install')} value={capability?.requiresInstall ? tk('Required') : tk('No')} />
          <SummaryChip label={tk('Approval')} value={capability?.requiresApproval ? tk('Required') : tk('No')} />
          <SummaryChip label={tk('Body')} value={capability?.canInspectBodies ? tk('Yes') : tk('No')} />
        </div>

        {status?.message ? <div style={hintStyle}>{status.message}</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        <div
          style={{
            ...workspaceStyle,
            gridTemplateColumns: singleColumnLayout ? '1fr' : 'minmax(0, 1fr) 360px',
          }}
        >
          <div style={tableShellStyle}>
            <div style={tableHeaderStyle}>
              <div style={{ ...headerCellStyle, width: '22%' }}>{tk('Name')}</div>
              <div style={{ ...headerCellStyle, width: '9%' }}>{tk('Status')}</div>
              <div style={{ ...headerCellStyle, width: '9%' }}>{tk('Type')}</div>
              <div style={{ ...headerCellStyle, width: '16%' }}>{tk('Process')}</div>
              <div style={{ ...headerCellStyle, width: '12%' }}>{tk('Transferred')}</div>
              <div style={{ ...headerCellStyle, width: '10%' }}>{tk('Time')}</div>
              <div style={{ ...headerCellStyle, flex: 1 }}>{tk('Waterfall')}</div>
            </div>

            {loading && filteredFlows.length === 0 ? (
              <div style={emptyStateStyle}>{tk('Loading...')}</div>
            ) : filteredFlows.length === 0 ? (
              <div style={emptyStateStyle}>
                {capability?.supported
                  ? tk('No requests match the current filters.')
                  : tk('Network capture is not available on this platform yet.')}
              </div>
            ) : (
              <div style={rowsWrapStyle}>
                {filteredFlows.map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => selectFlow(flow.id)}
                    style={{
                      ...tableRowStyle,
                      background: selectedFlow?.id === flow.id ? 'var(--bg-card-hover)' : 'transparent',
                    }}
                  >
                    <div style={{ ...rowCellStyle, width: '22%' }}>
                      <div style={nameCellStyle}>
                        <span style={requestNameStyle}>{getRequestName(flow)}</span>
                        <span style={requestSubStyle}>{flow.host ?? flow.ip ?? '-'}</span>
                      </div>
                    </div>
                    <div style={{ ...rowCellStyle, width: '9%' }}>
                      <span style={{ ...miniStatusStyle, ...statusToneStyles[getStatusTone(flow.status)] }}>
                        {getStatusLabel(flow)}
                      </span>
                    </div>
                    <div style={{ ...rowCellStyle, width: '9%' }}>{flow.protocol.toUpperCase()}</div>
                    <div style={{ ...rowCellStyle, width: '16%' }}>{flow.processName ?? tk('Unknown')}</div>
                    <div style={{ ...rowCellStyle, width: '12%' }}>{formatBytes(flow.rxBytes + flow.txBytes)}</div>
                    <div style={{ ...rowCellStyle, width: '10%' }}>{formatDuration(flow.durationMs)}</div>
                    <div style={{ ...rowCellStyle, flex: 1 }}>
                      <WaterfallBar flow={flow} minStart={waterfallMetrics.minStart} totalDuration={waterfallMetrics.totalDuration} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={detailShellStyle}>
            <div style={detailHeaderStyle}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={detailTitleStyle}>{selectedFlow ? getRequestName(selectedFlow) : tk('Request Detail')}</div>
                <div style={detailMetaStyle}>
                  {selectedFlow
                    ? `${selectedFlow.processName ?? tk('Unknown')} • ${selectedFlow.host ?? selectedFlow.ip ?? '-'}:${selectedFlow.port ?? '-'}`
                    : tk('Select a request from the table.')}
                </div>
              </div>
            </div>

            <div style={detailTabsStyle}>
              <DetailTabButton active={detailTab === 'headers'} label={tk('Headers')} onClick={() => setDetailTab('headers')} />
              <DetailTabButton active={detailTab === 'cookies'} label={tk('Cookies')} onClick={() => setDetailTab('cookies')} />
              <DetailTabButton active={detailTab === 'payload'} label={tk('Payload')} onClick={() => setDetailTab('payload')} />
              <DetailTabButton active={detailTab === 'response'} label={tk('Response')} onClick={() => setDetailTab('response')} />
              <DetailTabButton active={detailTab === 'timing'} label={tk('Timing')} onClick={() => setDetailTab('timing')} />
            </div>

            {selectedFlow ? (
              <div style={detailBodyStyle}>
                {detailTab === 'headers' ? <HeadersTab flow={selectedFlow} /> : null}
                {detailTab === 'cookies' ? <CookiesTab flow={selectedFlow} /> : null}
                {detailTab === 'payload' ? <PayloadTab flow={selectedFlow} /> : null}
                {detailTab === 'response' ? <ResponseTab flow={selectedFlow} /> : null}
                {detailTab === 'timing' ? <TimingTab flow={selectedFlow} /> : null}
              </div>
            ) : (
              <div style={emptyDetailStyle}>{tk('No request selected.')}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function HeadersTab({ flow }: { flow: NetworkFlowSummary }) {
  const requestUrl = buildRequestUrl(flow)
  return (
    <div style={detailSectionGridStyle}>
      <DetailSection
        title="General"
        rows={[
          ['Request URL', requestUrl],
          ['Request Method', flow.method ?? inferMethod(flow)],
          ['Status', inferStatus(flow)],
          ['Remote Address', flow.ip ?? '-'],
          ['Initiator', flow.initiator ?? 'other'],
          ['Referrer Policy', 'strict-origin-when-cross-origin'],
        ]}
      />
      <DetailSection
        title="Request Headers"
        rows={[
          ['accept', '*/*'],
          ['user-agent', flow.processName ?? 'SystemScope Mock Capture'],
          ['x-systemscope-mode', 'mock-metadata'],
          ['host', flow.host ?? flow.ip ?? '-'],
          [':path', flow.requestPath ?? '/'],
        ]}
      />
      <DetailSection
        title="Response Headers"
        rows={[
          ['content-type', flow.mimeType ?? inferContentType(flow)],
          ['server', 'mock-edge'],
          ['content-length', String(flow.rxBytes)],
          ['cache-control', 'private, max-age=0'],
        ]}
      />
    </div>
  )
}

function ResponseTab({ flow }: { flow: NetworkFlowSummary }) {
  const preview = [
    '{',
    `  "url": "${buildRequestUrl(flow)}",`,
    `  "method": "${flow.method ?? inferMethod(flow)}",`,
    `  "statusCode": ${flow.statusCode ?? 0},`,
    `  "process": "${flow.processName ?? 'unknown'}",`,
    `  "host": "${flow.host ?? flow.ip ?? 'unknown'}",`,
    `  "protocol": "${flow.protocol}",`,
    `  "receivedBytes": ${flow.rxBytes},`,
    `  "sentBytes": ${flow.txBytes},`,
    `  "status": "${flow.status}"`,
    '}',
  ].join('\n')

  return (
    <div style={detailSectionGridStyle}>
      <DetailSection
        title="Preview"
        rows={[
          ['Type', flow.mimeType ?? inferContentType(flow)],
          ['Encoding', 'utf-8'],
          ['Transferred', formatBytes(flow.rxBytes + flow.txBytes)],
          ['Preview source', flow.scheme ?? flow.protocol],
        ]}
      />
      <pre style={codeBlockStyle}>{preview}</pre>
    </div>
  )
}

function PayloadTab({ flow }: { flow: NetworkFlowSummary }) {
  const requestPayload = [
    '{',
    `  "operation": "${flow.method ?? inferMethod(flow)}",`,
    `  "initiator": "${flow.initiator ?? 'unknown'}",`,
    `  "target": "${flow.host ?? flow.ip ?? 'unknown'}",`,
    `  "path": "${flow.requestPath ?? '/'}",`,
    `  "bytesSent": ${flow.txBytes},`,
    `  "captureMode": "mock-http-transaction"`,
    '}',
  ].join('\n')

  return (
    <div style={detailSectionGridStyle}>
      <DetailSection
        title="Request Payload"
        rows={[
          ['Method', flow.method ?? inferMethod(flow)],
          ['Initiator', flow.initiator ?? 'unknown'],
          ['Sent', formatBytes(flow.txBytes)],
          ['MIME Type', flow.mimeType ?? inferContentType(flow)],
        ]}
      />
      <pre style={codeBlockStyle}>{requestPayload}</pre>
    </div>
  )
}

function CookiesTab({ flow }: { flow: NetworkFlowSummary }) {
  const cookieRows = getCookieRows(flow)

  return (
    <div style={detailSectionGridStyle}>
      <DetailSection
        title="Request Cookies"
        rows={cookieRows.request}
      />
      <DetailSection
        title="Response Cookies"
        rows={cookieRows.response}
      />
    </div>
  )
}

function TimingTab({ flow }: { flow: NetworkFlowSummary }) {
  const total = Math.max(flow.durationMs ?? 220, 1)
  const queueing = Math.round(total * 0.08)
  const stalled = Math.round(total * 0.14)
  const requestSent = Math.round(total * 0.07)
  const waiting = Math.round(total * 0.46)
  const contentDownload = Math.max(total - queueing - stalled - requestSent - waiting, 0)

  return (
    <div style={detailSectionGridStyle}>
      <DetailSection
        title="Connection Timing"
        rows={[
          ['Started', formatDateTime(flow.startedAt)],
          ['Finished', flow.endedAt ? formatDateTime(flow.endedAt) : 'In progress'],
          ['Duration', formatDuration(flow.durationMs)],
        ]}
      />
      <div style={timingListStyle}>
        <TimingRow label="Queueing" value={queueing} total={total} color="#64748b" />
        <TimingRow label="Stalled" value={stalled} total={total} color="#f59e0b" />
        <TimingRow label="Request sent" value={requestSent} total={total} color="#38bdf8" />
        <TimingRow label="Waiting (TTFB)" value={waiting} total={total} color="#22c55e" />
        <TimingRow label="Content download" value={contentDownload} total={total} color="#a855f7" />
      </div>
    </div>
  )
}

function DetailSection({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div style={detailSectionStyle}>
      <div style={detailSectionTitleStyle}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={detailRowStyle}>
            <div style={detailLabelStyle}>{label}</div>
            <div style={detailValueStyle}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WaterfallBar({
  flow,
  minStart,
  totalDuration,
}: {
  flow: NetworkFlowSummary
  minStart: number
  totalDuration: number
}) {
  const end = flow.endedAt ?? Date.now()
  const left = ((flow.startedAt - minStart) / totalDuration) * 100
  const width = Math.max(((end - flow.startedAt) / totalDuration) * 100, 3)
  const segments = getWaterfallSegments(flow)

  return (
    <div style={waterfallTrackStyle}>
      <div
        style={{
          ...waterfallBarStyle,
          left: `${Math.max(left, 0)}%`,
          width: `${Math.min(width, 100)}%`,
        }}
      >
        {segments.map((segment) => (
          <div
            key={segment.label}
            title={`${segment.label}: ${segment.ms} ms`}
            style={{
              width: `${segment.pct}%`,
              background: segment.color,
              height: '100%',
              minWidth: segment.ms > 0 ? '2px' : '0',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function TimingRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div style={timingRowStyle}>
      <div style={timingLabelStyle}>{label}</div>
      <div style={timingBarTrackStyle}>
        <div style={{ ...timingBarFillStyle, width: `${Math.max((value / Math.max(total, 1)) * 100, value > 0 ? 3 : 0)}%`, background: color }} />
      </div>
      <div style={timingValueStyle}>{value} ms</div>
    </div>
  )
}

function ToolbarToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ ...toggleButtonStyle, ...(active ? activeToggleStyle : inactiveToggleStyle) }}>
      {label}
    </button>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={summaryChipStyle}>
      <span style={summaryChipLabelStyle}>{label}</span>
      <strong style={summaryChipValueStyle}>{value}</strong>
    </span>
  )
}

function DetailTabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ ...detailTabButtonStyle, ...(active ? activeDetailTabButtonStyle : inactiveDetailTabButtonStyle) }}>
      {label}
    </button>
  )
}

function StatusBadge({ capabilitySupported, running }: { capabilitySupported: boolean; running: boolean }) {
  const label = running ? 'Running' : capabilitySupported ? 'Ready' : 'Unsupported'
  const tone = running ? activeToggleStyle : capabilitySupported ? readyBadgeStyle : unsupportedBadgeStyle
  return <span style={{ ...statusBadgeStyle, ...tone }}>{label}</span>
}

function getRequestName(flow: NetworkFlowSummary): string {
  if (flow.requestPath) {
    const parts = flow.requestPath.split('/').filter(Boolean)
    const last = parts.at(-1)
    if (last) return last.length > 28 ? `${last.slice(0, 28)}...` : last
  }
  if (flow.ip) return flow.ip
  if (flow.host) return flow.host.split('.').slice(0, 2).join('.')
  return 'unknown'
}

function getCookieRows(flow: NetworkFlowSummary): {
  request: Array<[string, string]>
  response: Array<[string, string]>
} {
  if (flow.host?.includes('github.com')) {
    return {
      request: [
        ['_gh_sess', '***'],
        ['logged_in', 'yes'],
      ],
      response: [
        ['logged_in', 'yes; Secure; HttpOnly'],
      ],
    }
  }

  if (flow.host?.includes('youtube.com')) {
    return {
      request: [
        ['VISITOR_INFO1_LIVE', '***'],
        ['PREF', 'tz=Asia.Seoul'],
      ],
      response: [
        ['YSC', '***; Secure; SameSite=None'],
      ],
    }
  }

  if (flow.host?.includes('discordapp.com')) {
    return {
      request: [
        ['__dcfduid', '***'],
      ],
      response: [
        ['__sdcfduid', '***; Secure; HttpOnly'],
      ],
    }
  }

  return {
    request: [
      ['session', '***'],
    ],
    response: [
      ['trace', `${flow.id.slice(0, 12)}...; Secure`],
    ],
  }
}

function getStatusLabel(flow: NetworkFlowSummary): string {
  if (typeof flow.statusCode === 'number' && flow.statusCode > 0) return String(flow.statusCode)
  if (flow.protocol === 'dns') return 'DNS'
  return flow.status
}

function inferMethod(flow: NetworkFlowSummary): string {
  if (flow.protocol === 'dns') return 'QUERY'
  if (flow.protocol === 'ws') return 'GET'
  return flow.direction === 'outbound' ? 'GET' : 'POST'
}

function inferStatus(flow: NetworkFlowSummary): string {
  if (typeof flow.statusCode === 'number' && flow.statusCode > 0) {
    if (flow.statusCode === 101) return '101 Switching Protocols'
    if (flow.statusCode === 200) return '200 OK'
    if (flow.statusCode === 502) return '502 Bad Gateway'
    return String(flow.statusCode)
  }
  if (flow.protocol === 'dns') return flow.status === 'failed' ? 'NXDOMAIN' : 'NOERROR'
  if (flow.status === 'failed') return '502 Bad Gateway'
  if (flow.status === 'open') return '101 Switching Protocols'
  return '200 OK'
}

function inferContentType(flow: NetworkFlowSummary): string {
  if (flow.protocol === 'dns') return 'application/dns-message'
  if (flow.protocol === 'ws') return 'application/websocket'
  return 'application/json'
}

function buildRequestUrl(flow: NetworkFlowSummary): string {
  const scheme = flow.scheme ?? (flow.protocol === 'https' || flow.protocol === 'http' ? flow.protocol : 'https')
  const authority = flow.host ?? flow.ip ?? 'unknown'
  const path = flow.requestPath ?? '/'
  return `${scheme}://${authority}${flow.port ? `:${flow.port}` : ''}${path.startsWith('/') ? path : `/${path}`}`
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return 'Pending'
  return `${durationMs} ms`
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

function getStatusTone(status: NetworkFlowSummary['status']): 'ready' | 'active' | 'unsupported' {
  if (status === 'open') return 'active'
  if (status === 'failed') return 'unsupported'
  return 'ready'
}

function getWaterfallColor(protocol: NetworkFlowSummary['protocol']): string {
  switch (protocol) {
    case 'dns':
      return '#f59e0b'
    case 'https':
      return '#22c55e'
    case 'http':
      return '#38bdf8'
    case 'ws':
      return '#a855f7'
    case 'tcp':
      return '#64748b'
    default:
      return '#94a3b8'
  }
}

function getWaterfallSegments(flow: NetworkFlowSummary): Array<{ label: string; ms: number; pct: number; color: string }> {
  const total = Math.max(flow.durationMs ?? 220, 1)
  const parts = [
    { label: 'Queueing', ms: Math.round(total * 0.08), color: '#64748b' },
    { label: 'Stalled', ms: Math.round(total * 0.12), color: '#f59e0b' },
    { label: 'Request', ms: Math.round(total * 0.07), color: '#38bdf8' },
    { label: 'Waiting', ms: Math.round(total * 0.46), color: '#22c55e' },
  ]
  const used = parts.reduce((sum, item) => sum + item.ms, 0)
  const downloadMs = Math.max(total - used, 0)
  const finalParts = [...parts, { label: 'Download', ms: downloadMs, color: getWaterfallColor(flow.protocol) }]
  return finalParts.map((part) => ({
    ...part,
    pct: (part.ms / total) * 100,
  }))
}

const rootStyle: React.CSSProperties = {
  minWidth: 0,
}

const shellStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '12px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 76%, var(--bg-card)) 0%, var(--bg-card) 100%)',
}

const toolbarLeftStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const toolbarRightStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const recordButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontWeight: 700,
}

const recordDotStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  flexShrink: 0,
}

const toolbarButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontWeight: 600,
}

const toggleButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '999px',
  border: '1px solid var(--border)',
  fontSize: '11px',
  fontWeight: 700,
}

const activeToggleStyle: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--accent-blue) 18%, var(--bg-card))',
  borderColor: 'color-mix(in srgb, var(--accent-blue) 32%, var(--border))',
  color: 'var(--accent-blue)',
}

const inactiveToggleStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
}

const statusBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 10px',
  borderRadius: '999px',
  border: '1px solid var(--border)',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const readyBadgeStyle: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--accent-green) 16%, var(--bg-card))',
  color: 'var(--accent-green)',
  borderColor: 'color-mix(in srgb, var(--accent-green) 28%, var(--border))',
}

const unsupportedBadgeStyle: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--accent-red) 12%, var(--bg-card))',
  color: 'var(--accent-red)',
  borderColor: 'color-mix(in srgb, var(--accent-red) 28%, var(--border))',
}

const searchInputStyle: React.CSSProperties = {
  minWidth: '220px',
  padding: '7px 10px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: '12px',
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: '12px',
}

const summaryBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '0 14px',
  flexWrap: 'wrap',
  alignItems: 'center',
}

const summaryChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 6,
  alignItems: 'center',
  padding: '4px 8px',
  borderRadius: '999px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  fontSize: '11px',
}

const summaryChipLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
}

const summaryChipValueStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
}

const hintStyle: React.CSSProperties = {
  padding: '0 14px',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
}

const errorStyle: React.CSSProperties = {
  margin: '0 14px',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid color-mix(in srgb, var(--accent-red) 35%, var(--border))',
  background: 'color-mix(in srgb, var(--accent-red) 10%, var(--bg-card))',
  color: 'var(--accent-red)',
  fontSize: '12px',
}

const workspaceStyle: React.CSSProperties = {
  display: 'grid',
  gap: 0,
  height: 'clamp(620px, 72vh, 840px)',
  overflow: 'hidden',
}

const tableShellStyle: React.CSSProperties = {
  minWidth: 0,
  borderTop: '1px solid var(--border)',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  minHeight: 0,
}

const tableHeaderStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  padding: '8px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
}

const headerCellStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const rowsWrapStyle: React.CSSProperties = {
  display: 'grid',
  overflow: 'auto',
  minHeight: 0,
}

const tableRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  width: '100%',
  minWidth: 0,
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  padding: '10px 14px',
}

const rowCellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  fontSize: '12px',
  color: 'var(--text-primary)',
}

const nameCellStyle: React.CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
}

const requestNameStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const requestSubStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const miniStatusStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 6px',
  borderRadius: '999px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  border: '1px solid transparent',
}

const statusToneStyles: Record<'ready' | 'active' | 'unsupported', React.CSSProperties> = {
  ready: readyBadgeStyle,
  active: activeToggleStyle,
  unsupported: unsupportedBadgeStyle,
}

const waterfallTrackStyle: React.CSSProperties = {
  position: 'relative',
  height: '8px',
  width: '100%',
  borderRadius: '999px',
  background: 'var(--bg-secondary)',
  overflow: 'hidden',
}

const waterfallBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  borderRadius: '999px',
  display: 'flex',
  overflow: 'hidden',
}

const detailShellStyle: React.CSSProperties = {
  minWidth: 0,
  borderLeft: '1px solid var(--border)',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr',
  minHeight: 0,
  overflow: 'hidden',
}

const detailHeaderStyle: React.CSSProperties = {
  padding: '14px',
  borderBottom: '1px solid var(--border)',
}

const detailTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text-primary)',
}

const detailMetaStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
}

const detailTabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  flexWrap: 'wrap',
}

const detailTabButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  fontSize: '11px',
  fontWeight: 700,
}

const activeDetailTabButtonStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
}

const inactiveDetailTabButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-secondary)',
}

const detailBodyStyle: React.CSSProperties = {
  padding: '14px',
  overflow: 'auto',
  display: 'grid',
  gap: 14,
}

const emptyStateStyle: React.CSSProperties = {
  minHeight: '280px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  color: 'var(--text-secondary)',
  fontSize: '13px',
  padding: '20px',
}

const emptyDetailStyle: React.CSSProperties = {
  minHeight: '220px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-secondary)',
  fontSize: '13px',
  padding: '20px',
}

const detailSectionGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
}

const detailSectionStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
}

const detailSectionTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
}

const detailRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
}

const detailLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
}

const detailValueStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-primary)',
  wordBreak: 'break-word',
  fontFamily: 'monospace',
}

const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: '#0f172a',
  color: '#dbeafe',
  fontSize: '12px',
  lineHeight: 1.6,
  overflow: 'auto',
}

const timingListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
}

const timingRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px 1fr 56px',
  gap: 10,
  alignItems: 'center',
}

const timingLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
}

const timingBarTrackStyle: React.CSSProperties = {
  height: '8px',
  borderRadius: '999px',
  background: 'var(--bg-card)',
  overflow: 'hidden',
}

const timingBarFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: '999px',
}

const timingValueStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-primary)',
  textAlign: 'right',
  fontFamily: 'monospace',
}
