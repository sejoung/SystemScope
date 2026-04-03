import { useState } from 'react'
import { PageTab } from '../components/PageTab'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { CleanupInboxView } from '../features/cleanup/CleanupInboxView'
import { CleanupRulesView } from '../features/cleanup/CleanupRulesView'
import { AutomationHistoryCard } from '../features/cleanup/AutomationHistoryCard'
import { CleanupWorkspaceView } from '../features/cleanup/CleanupWorkspaceView'
import { useI18n } from '../i18n/useI18n'

type CleanupTab = 'inbox' | 'workspace' | 'rules' | 'automation'

export function CleanupPage() {
  const [tab, setTab] = useState<CleanupTab>('inbox')
  const { t, tk } = useI18n()

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
        <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", color: "var(--text-muted)" }}>
          <span style={{ color: tab === 'inbox' ? 'var(--accent-blue)' : 'inherit', fontWeight: tab === 'inbox' ? 600 : 400 }}>
            {t("1. Review candidates")}
          </span>
          <span>→</span>
          <span style={{ color: tab === 'rules' ? 'var(--accent-blue)' : 'inherit', fontWeight: tab === 'rules' ? 600 : 400 }}>
            {t("2. Configure rules")}
          </span>
          <span>→</span>
          <span style={{ color: tab === 'workspace' ? 'var(--accent-blue)' : 'inherit', fontWeight: tab === 'workspace' ? 600 : 400 }}>
            {t("3. Clean workspace")}
          </span>
          <span>→</span>
          <span style={{ color: tab === 'automation' ? 'var(--accent-blue)' : 'inherit', fontWeight: tab === 'automation' ? 600 : 400 }}>
            {t("4. Review history")}
          </span>
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
          <PageTab
            id="cleanup-workspace"
            active={tab === 'workspace'}
            onClick={() => setTab('workspace')}
          >
            {t('Workspace')}
          </PageTab>
          <PageTab
            id="cleanup-automation"
            active={tab === 'automation'}
            onClick={() => setTab('automation')}
          >
            {t('Automation')}
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
      {tab === 'workspace' && (
        <ErrorBoundary title={t('Workspace Cleanup')}>
          <CleanupWorkspaceView />
        </ErrorBoundary>
      )}
      {tab === 'automation' && (
        <ErrorBoundary title={t('Automation History')}>
          <AutomationHistoryCard />
        </ErrorBoundary>
      )}
    </div>
  )
}
