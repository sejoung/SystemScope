import type { ShutdownState } from '@shared/types'

export function ShutdownOverlay({ state, title }: { state: ShutdownState; title: string }) {
  return (
    <div style={overlayStyle}>
      <div style={overlayCardStyle}>
        <div style={spinnerStyle} />
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{state.message}</div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(15, 23, 42, 0.46)',
  backdropFilter: 'blur(8px)',
  zIndex: 9999,
}

const overlayCardStyle: React.CSSProperties = {
  minWidth: '280px',
  maxWidth: '420px',
  display: 'grid',
  gap: '10px',
  justifyItems: 'center',
  padding: '24px 28px',
  borderRadius: '16px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
}

const spinnerStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '999px',
  border: '3px solid color-mix(in srgb, var(--accent-blue) 22%, transparent)',
  borderTopColor: 'var(--accent-blue)',
  animation: 'systemscope-spin 0.9s linear infinite',
}
