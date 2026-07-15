import type { CSSProperties } from 'react'

export const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 8px',
  color: 'var(--text-muted)',
  fontWeight: 600,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap'
}

export const tdStyle: CSSProperties = {
  padding: '12px 8px',
  color: 'var(--text-secondary)',
  verticalAlign: 'top',
  fontSize: '14px',
  lineHeight: 1.4
}

export const actionBtnStyle: CSSProperties = {
  padding: '7px 12px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--accent-cyan)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}

export const rowStyle: CSSProperties = {
  borderBottom: '1px solid var(--border)'
}
