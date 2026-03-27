import { useEffect, useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { useToast } from '../../components/Toast'
import type { DockerBuildCacheScanResult, DockerPruneResult } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'

export function DockerBuildCache({
  refreshToken = 0,
  onChanged
}: {
  refreshToken?: number
  onChanged?: () => void
}) {
  const showToast = useToast((s) => s.show)
  const { tk } = useI18n()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<DockerBuildCacheScanResult['status']>('ready')
  const [summary, setSummary] = useState<DockerBuildCacheScanResult['summary']>(null)
  const [message, setMessage] = useState<string | null>(tk('docker.build_cache.initial'))

  const scanBuildCache = async () => {
    setLoading(true)
    const res = await window.systemScope.getDockerBuildCache()
    if (!res.ok) {
      setStatus('daemon_unavailable')
      setSummary(null)
      setMessage(res.error?.message ?? tk('docker.build_cache.load_failed'))
      setLoading(false)
      return
    }
    if (!res.data) {
      setLoading(false)
      return
    }

    const data = res.data as DockerBuildCacheScanResult
    setStatus(data.status)
    setSummary(data.summary)
    setMessage(data.message)
    setLoading(false)
  }

  useEffect(() => {
    void scanBuildCache()
  }, [refreshToken])

  const handlePrune = async () => {
    const res = await window.systemScope.pruneDockerBuildCache()
    if (!res.ok) {
      showToast(res.error?.message ?? tk('docker.build_cache.prune_failed'))
      return
    }
    if (!res.data) return

    const result = res.data as DockerPruneResult
    if (result.cancelled) return
    showToast(tk('docker.build_cache.pruned', { label: result.reclaimedLabel }))
    onChanged?.()
    await scanBuildCache()
  }

  return (
    <Accordion
      title={tk('docker.build_cache.title')}
      defaultOpen
      badge={status === 'ready' && summary ? summary.reclaimableLabel : undefined}
      badgeColor="var(--accent-cyan)"
      actions={
        <>
          <button onClick={() => void scanBuildCache()} disabled={loading} style={actionBtnStyle}>
            {loading ? tk('common.refreshing') : tk('apps.action.refresh')}
          </button>
          <button
            onClick={() => void handlePrune()}
            disabled={loading || !summary || summary.reclaimableBytes <= 0}
            style={{ ...actionBtnStyle, background: 'var(--accent-red)' }}
          >
            {tk('docker.build_cache.prune')}
          </button>
        </>
      }
    >
      {status !== 'ready' ? (
        <EmptyState
          title={status === 'not_installed' ? tk('main.docker.status.not_installed') : tk('main.docker.status.daemon_unavailable')}
          detail={message ?? tk('docker.common.check_status')}
        />
      ) : !summary ? (
        <EmptyState title={message ?? tk('docker.build_cache.empty_info')} detail={tk('docker.build_cache.retry_refresh')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <MetricCard label={tk('docker.build_cache.entries')} value={String(summary.totalCount)} />
          <MetricCard label={tk('docker.build_cache.active')} value={String(summary.activeCount)} />
          <MetricCard label={tk('docker.build_cache.total_size')} value={summary.sizeLabel} />
          <MetricCard label={tk('docker.build_cache.reclaimable')} value={summary.reclaimableLabel} accent />
        </div>
      )}
    </Accordion>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ padding: '28px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{detail}</div>
    </div>
  )
}

function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ marginTop: '8px', fontSize: '22px', fontWeight: 800, color: accent ? 'var(--accent-red)' : 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

const actionBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--accent-cyan)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}
