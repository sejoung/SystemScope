import { useEffect, useState } from 'react'
import { useCleanupStore } from '../../stores/useCleanupStore'
import { useI18n } from '../../i18n/useI18n'
import { formatBytes } from '@shared/utils/formatBytes'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorBoundary } from '../../components/ErrorBoundary'

const SAFETY_COLORS: Record<string, string> = {
  safe: 'var(--accent-green)',
  caution: 'var(--accent-yellow)',
  risky: 'var(--accent-red)',
}

const CATEGORY_LABELS: Record<string, string> = {
  downloads: 'Downloads',
  dev_tools: 'Dev Tools',
  package_managers: 'Package Managers',
  docker: 'Docker',
  system: 'System',
}

function relativeAge(
  modifiedAt: number,
  t: (text: string, params?: Record<string, string | number>) => string,
): string {
  const diffMs = Date.now() - modifiedAt
  const days = Math.floor(diffMs / 86_400_000)
  if (days < 1) return t('< 1 day')
  if (days === 1) return t('1 day ago')
  if (days < 30) return t('{count} days ago', { count: days })
  const months = Math.floor(days / 30)
  if (months === 1) return t('1 month ago')
  return t('{count} months ago', { count: months })
}

function truncatePath(path: string, maxLen = 60): string {
  if (path.length <= maxLen) return path
  const start = path.slice(0, 20)
  const end = path.slice(-36)
  return `${start}...${end}`
}

export function CleanupInboxView() {
  const inbox = useCleanupStore((s) => s.inbox)
  const inboxLoading = useCleanupStore((s) => s.inboxLoading)
  const executing = useCleanupStore((s) => s.executing)
  const previewLoading = useCleanupStore((s) => s.previewLoading)
  const fetchInbox = useCleanupStore((s) => s.fetchInbox)
  const runPreview = useCleanupStore((s) => s.runPreview)
  const executeCleanup = useCleanupStore((s) => s.executeCleanup)
  const dismissItem = useCleanupStore((s) => s.dismissItem)
  const lastResult = useCleanupStore((s) => s.lastResult)
  const { tk, t } = useI18n()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPaths, setPendingPaths] = useState<string[]>([])

  useEffect(() => {
    void fetchInbox()
  }, [fetchInbox])

  const handleScanNow = async () => {
    await runPreview()
    await fetchInbox()
  }

  const handleApproveAllSafe = () => {
    if (!inbox) return
    const safePaths = inbox.items
      .filter((item) => item.safetyLevel === 'safe')
      .map((item) => item.path)
    if (safePaths.length === 0) return
    setPendingPaths(safePaths)
    setConfirmOpen(true)
  }

  const handleConfirmExecute = async () => {
    setConfirmOpen(false)
    await executeCleanup(pendingPaths)
    await fetchInbox()
    setPendingPaths([])
  }

  const items = inbox?.items ?? []
  const safeCount = items.filter((i) => i.safetyLevel === 'safe').length

  return (
    <ErrorBoundary title={tk('cleanup.inbox.title')}>
      <div style={{ display: 'grid', gap: '16px' }}>
        {/* Summary bar */}
        <div style={summaryBarStyle}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {t('{count} items', { count: items.length })} &middot; {formatBytes(inbox?.totalReclaimable ?? 0)} {t('reclaimable')}
            </span>
            {lastResult && (
              <span style={{ fontSize: '12px', color: 'var(--accent-green)' }}>
                {tk('cleanup.execute.success')}: {formatBytes(lastResult.deletedSize)}
                {lastResult.failedCount > 0 && (
                  <span style={{ color: 'var(--accent-red)', marginLeft: '8px' }}>
                    ({lastResult.failedCount} {t('failed')})
                  </span>
                )}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => void handleScanNow()}
              disabled={previewLoading || inboxLoading}
              style={actionBtnStyle}
            >
              {previewLoading ? tk('cleanup.preview.scanning') : t('Scan Now')}
            </button>
            {safeCount > 0 && (
              <button
                type="button"
                onClick={handleApproveAllSafe}
                disabled={executing}
                style={{ ...actionBtnStyle, background: 'var(--accent-green)' }}
              >
                {tk('cleanup.inbox.approve_all')} ({safeCount})
              </button>
            )}
          </div>
        </div>

        {/* Item list */}
        {inboxLoading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            {t('Loading...')}
          </div>
        )}

        {!inboxLoading && items.length === 0 && (
          <div style={emptyStyle}>
            {tk('cleanup.inbox.empty')}
          </div>
        )}

        {!inboxLoading && items.length > 0 && (
          <div style={{ display: 'grid', gap: '8px' }}>
            {items.map((item) => (
              <div key={item.id} style={itemCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Safety badge */}
                  <span style={{
                    ...badgeStyle,
                    background: `color-mix(in srgb, ${SAFETY_COLORS[item.safetyLevel]} 15%, transparent)`,
                    color: SAFETY_COLORS[item.safetyLevel],
                    border: `1px solid color-mix(in srgb, ${SAFETY_COLORS[item.safetyLevel]} 30%, transparent)`,
                  }}>
                    {tk(`cleanup.inbox.safety.${item.safetyLevel}` as 'cleanup.inbox.safety.safe' | 'cleanup.inbox.safety.caution' | 'cleanup.inbox.safety.risky')}
                  </span>
                  {/* Rule name + category */}
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t(item.ruleName)}
                  </span>
                  <span style={{ ...badgeStyle, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {t(CATEGORY_LABELS[item.category] ?? item.category)}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>
                  {truncatePath(item.path)}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatBytes(item.size)}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {relativeAge(item.modifiedAt, t)}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>
                    {t('{rule} matched this item for cleanup review.', {
                      rule: t(item.ruleName),
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => void dismissItem(item.path)}
                    title={tk('cleanup.inbox.dismiss')}
                    style={dismissBtnStyle}
                    aria-label={tk('cleanup.inbox.dismiss')}
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={tk('cleanup.execute.confirm')}
        message={t('This will move {count} safe items ({size}) to trash.', {
          count: pendingPaths.length,
          size: formatBytes(
            items.filter((i) => pendingPaths.includes(i.path)).reduce((s, i) => s + i.size, 0)
          ),
        })}
        confirmLabel={t('Clean')}
        cancelLabel={t('Cancel')}
        tone="danger"
        onConfirm={() => void handleConfirmExecute()}
        onCancel={() => { setConfirmOpen(false); setPendingPaths([]) }}
      />
    </ErrorBoundary>
  )
}

const summaryBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  flexWrap: 'wrap',
  gap: '10px',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer',
}

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '48px 20px',
  color: 'var(--text-muted)',
  fontSize: '13px',
}

const itemCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '12px 16px',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
}

const badgeStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '999px',
  whiteSpace: 'nowrap',
}

const dismissBtnStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontWeight: 700,
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  flexShrink: 0,
}
