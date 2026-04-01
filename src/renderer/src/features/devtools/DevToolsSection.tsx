import { useEffect, useState } from 'react'
import { useDevToolsStore } from '../../stores/useDevToolsStore'
import { useI18n } from '../../i18n/useI18n'
import { formatBytes } from '@shared/utils/formatBytes'
import { DevToolsDetailDialog } from './DevToolsDetailDialog'
import type { ToolIntegrationResult } from '@shared/types'

const STATUS_COLORS: Record<string, string> = {
  ready: 'var(--accent-green)',
  not_installed: 'var(--text-tertiary)',
  error: 'var(--accent-red)'
}

export function DevToolsSection() {
  const { tk } = useI18n()
  const results = useDevToolsStore((s) => s.results)
  const scanning = useDevToolsStore((s) => s.scanning)
  const scanned = useDevToolsStore((s) => s.scanned)
  const scan = useDevToolsStore((s) => s.scan)
  const error = useDevToolsStore((s) => s.error)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    if (!scanned && !scanning) void scan()
  }, [scanned, scanning, scan])

  const totalReclaimable = results.reduce((sum, r) => sum + r.reclaimable.reduce((s, item) => s + item.size, 0), 0)
  const totalItems = results.reduce((sum, r) => sum + r.reclaimable.length, 0)

  return (
    <div style={{ padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{tk('devtools.section.title')}</h3>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{tk('devtools.section.description')}</div>
        </div>
        <button onClick={() => void scan()} disabled={scanning} style={{
          padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          cursor: scanning ? 'not-allowed' : 'pointer', opacity: scanning ? 0.6 : 1
        }}>
          {scanning ? tk('devtools.scanning') : scanned ? tk('devtools.rescan') : tk('devtools.scan')}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 8 }}>{error}</div>}

      {results.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {results.map((result) => <ToolCard key={result.tool} result={result} />)}
          {totalItems > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatBytes(totalReclaimable)} reclaimable</span>
              <button onClick={() => setDetailOpen(true)} style={{
                padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius)',
                border: 'none', background: 'var(--accent-blue)', color: 'var(--text-on-accent)', cursor: 'pointer'
              }}>{tk('devtools.detail.clean_selected')}</button>
            </div>
          )}
          {scanned && totalItems === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 8 }}>{tk('devtools.no_reclaimable')}</div>
          )}
        </div>
      )}

      <DevToolsDetailDialog open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  )
}

function ToolCard({ result }: { result: ToolIntegrationResult }) {
  const { tk } = useI18n()
  const statusColor = STATUS_COLORS[result.status] ?? 'var(--text-tertiary)'
  const toolLabelMap: Record<string, string> = {
    homebrew: tk('devtools.tool.homebrew'),
    xcode: tk('devtools.tool.xcode'),
    vscode: tk('devtools.tool.vscode'),
    toolchain: tk('devtools.tool.toolchain'),
  }
  const toolLabel = toolLabelMap[result.tool] ?? result.tool
  const statusLabel = result.status === 'ready' ? tk('devtools.status.ready')
    : result.status === 'not_installed' ? tk('devtools.status.not_installed') : tk('devtools.status.error')

  return (
    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{toolLabel}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
      </div>
      {result.status === 'ready' && result.summary.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
          {result.summary.map((item) => (
            <div key={item.key} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>{item.label}: </span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {result.message && result.status !== 'ready' && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{result.message}</div>
      )}
    </div>
  )
}
