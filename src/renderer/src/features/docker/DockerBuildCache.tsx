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
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<DockerBuildCacheScanResult['status']>('ready')
  const [summary, setSummary] = useState<DockerBuildCacheScanResult['summary']>(null)
  const [message, setMessage] = useState<string | null>(t('Docker build cache를 조회해보세요.'))

  const scanBuildCache = async () => {
    setLoading(true)
    const res = await window.systemScope.getDockerBuildCache()
    if (!res.ok || !res.data) {
      setStatus('daemon_unavailable')
      setSummary(null)
      setMessage(res.error?.message ?? t('Docker build cache를 조회하지 못했습니다.'))
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
    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? t('Docker build cache를 정리하지 못했습니다.'))
      return
    }

    const result = res.data as DockerPruneResult
    if (result.cancelled) return
    showToast(t('Docker build cache 정리 완료: {label}', { label: result.reclaimedLabel }))
    onChanged?.()
    await scanBuildCache()
  }

  return (
    <Accordion
      title={t('Build Cache')}
      defaultOpen
      badge={status === 'ready' && summary ? summary.reclaimableLabel : undefined}
      badgeColor="var(--accent-cyan)"
      actions={
        <>
          <button onClick={() => void scanBuildCache()} disabled={loading} style={actionBtnStyle}>
            {loading ? t('Refreshing...') : t('Refresh')}
          </button>
          <button
            onClick={() => void handlePrune()}
            disabled={loading || !summary || summary.reclaimableBytes <= 0}
            style={{ ...actionBtnStyle, background: 'var(--accent-red)' }}
          >
            {t('Prune Cache')}
          </button>
        </>
      }
    >
      {status !== 'ready' ? (
        <EmptyState
          title={status === 'not_installed' ? t('Docker가 설치되어 있지 않습니다.') : t('Docker daemon에 연결할 수 없습니다.')}
          detail={message ?? t('Docker Desktop 또는 Docker Engine 상태를 확인하세요.')}
        />
      ) : !summary ? (
        <EmptyState title={message ?? t('Docker build cache 정보가 없습니다.')} detail={t('Refresh로 다시 시도하세요.')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <MetricCard label={t('Cache Entries')} value={String(summary.totalCount)} />
          <MetricCard label={t('Active')} value={String(summary.activeCount)} />
          <MetricCard label={t('Total Size')} value={summary.sizeLabel} />
          <MetricCard label={t('Reclaimable')} value={summary.reclaimableLabel} accent />
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
