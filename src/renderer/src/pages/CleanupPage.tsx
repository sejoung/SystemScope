import { useState } from 'react'
import { PageTab } from '../components/PageTab'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { CleanupInboxView } from '../features/cleanup/CleanupInboxView'
import { CleanupRulesView } from '../features/cleanup/CleanupRulesView'
import { useI18n } from '../i18n/useI18n'

type CleanupTab = 'inbox' | 'rules'

export function CleanupPage() {
  const [tab, setTab] = useState<CleanupTab>('inbox')
  const { tk } = useI18n()

  return (
    <div data-testid="page-cleanup">
      <div
        style={{
          display: 'grid',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'grid', gap: '6px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
            {tk('cleanup.title')}
          </h2>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            {tk('cleanup.inbox.description')}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={tk('cleanup.title')}
          style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '3px',
          }}
        >
          <PageTab
            id="cleanup-inbox"
            active={tab === 'inbox'}
            onClick={() => setTab('inbox')}
          >
            {tk('cleanup.inbox.title')}
          </PageTab>
          <PageTab
            id="cleanup-rules"
            active={tab === 'rules'}
            onClick={() => setTab('rules')}
          >
            {tk('cleanup.rules.title')}
          </PageTab>
        </div>
      </div>

      {tab === 'inbox' && (
        <ErrorBoundary title={tk('cleanup.inbox.title')}>
          <CleanupInboxView />
        </ErrorBoundary>
      )}
      {tab === 'rules' && (
        <ErrorBoundary title={tk('cleanup.rules.title')}>
          <CleanupRulesView />
        </ErrorBoundary>
      )}
    </div>
  )
}
