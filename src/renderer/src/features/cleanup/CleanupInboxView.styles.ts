import type { CSSProperties } from 'react'

export const summaryBarStyle: CSSProperties = {
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

export const actionBtnStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer',
}

export const emptyStyle: CSSProperties = {
  textAlign: 'center',
  padding: '48px 20px',
  color: 'var(--text-muted)',
  fontSize: '13px',
}

export const itemCardStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '12px 16px',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
}

export const badgeStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '999px',
  whiteSpace: 'nowrap',
}

export const searchInputStyle: CSSProperties = {
  padding: '8px 12px',
  fontSize: '13px',
  width: '240px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  outline: 'none',
}

export const dismissBtnStyle: CSSProperties = {
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
