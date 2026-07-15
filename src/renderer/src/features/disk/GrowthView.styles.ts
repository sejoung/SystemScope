import type { CSSProperties } from 'react'

export const btnStyle: CSSProperties = {
  padding: '4px 12px',
  fontSize: '11px',
  fontWeight: 600,
  border: '1px solid color-mix(in srgb, var(--accent-yellow) 35%, var(--border))',
  borderRadius: '6px',
  background: 'color-mix(in srgb, var(--accent-yellow) 18%, var(--bg-card))',
  color: 'var(--text-on-accent-strong)',
  cursor: 'pointer'
}

export const summaryPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 8px',
  borderRadius: '999px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)'
}

export const cardBodyStyle: CSSProperties = {
  minHeight: '360px'
}

export const placeholderBlockStyle: CSSProperties = {
  background: 'var(--bg-primary)',
  borderRadius: '8px'
}

export const spinnerStyle: CSSProperties = {
  width: '14px',
  height: '14px',
  border: '2px solid var(--accent-yellow)',
  borderTop: '2px solid transparent',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite'
}

export const spinnerSpacerStyle: CSSProperties = {
  width: '14px',
  height: '14px',
  flexShrink: 0
}

export const dashboardCardStyle: CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column'
}

export const dashboardCardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  flexWrap: 'wrap'
}

export const dashboardCardTitleStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)'
}

export const dashboardCardActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap'
}

export const dashboardCardContentStyle: CSSProperties = {
  padding: '16px'
}
