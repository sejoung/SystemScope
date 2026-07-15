import type { CSSProperties } from 'react'

export const cardStyle: CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '16px',
  marginBottom: '16px'
}

export const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px'
}

export const badgeStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 'var(--radius)'
}

export const itemContainerStyle: CSSProperties = {
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  overflow: 'hidden'
}

export const itemHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '8px 12px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  textAlign: 'left',
  font: 'inherit'
}

export const categoryBadgeStyle: CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 'var(--radius)',
  background: 'color-mix(in srgb, var(--text-muted) 12%, transparent)',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  flexShrink: 0
}

export const expandedContentStyle: CSSProperties = {
  padding: '8px 12px 12px',
  borderTop: '1px solid var(--border)'
}

export const evidenceTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px'
}

export const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px 4px 0',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border)'
}

export const tdStyle: CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px 4px 0',
  color: 'var(--text-primary)'
}

export const actionButtonStyle: CSSProperties = {
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: 600,
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--accent-blue)',
  cursor: 'pointer'
}

export const showAllButtonStyle: CSSProperties = {
  padding: '6px 0',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  background: 'none',
  color: 'var(--accent-blue)',
  cursor: 'pointer',
  textAlign: 'center'
}
