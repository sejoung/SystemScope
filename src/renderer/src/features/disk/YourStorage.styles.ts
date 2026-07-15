import type { CSSProperties } from 'react'

export const subtleActionButtonStyle: CSSProperties = {
  padding: '4px 12px',
  fontSize: '11px',
  fontWeight: 600,
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)'
}

export const cardBodyStyle: CSSProperties = {
  minHeight: '360px'
}

export const placeholderBlockStyle: CSSProperties = {
  background: 'var(--bg-primary)',
  borderRadius: '8px'
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
