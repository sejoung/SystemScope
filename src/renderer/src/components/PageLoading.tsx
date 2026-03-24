import { useI18n } from '../i18n/useI18n'

export function PageLoading() {
  const { tk } = useI18n()

  return (
    <div data-testid="page-loading" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '80px 0',
      color: 'var(--text-muted)'
    }}>
      <div style={{
        width: '24px',
        height: '24px',
        border: '2.5px solid var(--border)',
        borderTop: '2.5px solid var(--accent-blue)',
        borderRadius: '50%',
        animation: 'page-loading-spin 0.8s linear infinite'
      }} />
      <span style={{ fontSize: '13px' }}>{tk('monitoring.loading')}</span>
      <style>{`@keyframes page-loading-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
