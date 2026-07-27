import type { CSSProperties } from 'react'

export const sectionStyle: CSSProperties = {
  padding: '16px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-card)',
  display: 'grid',
  gap: '14px'
}

export const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px'
}

export const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '16px',
  color: 'var(--text-primary)'
}

export const descriptionStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: '13px',
  lineHeight: 1.6,
  color: 'var(--text-secondary)'
}

export const countBadgeStyle: CSSProperties = {
  padding: '3px 9px',
  borderRadius: '999px',
  background: 'var(--bg-card-hover)',
  color: 'var(--text-secondary)',
  fontWeight: 700,
  fontSize: '12px'
}

export const controlsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px'
}

export const filterGroupStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px'
}

export const filterButtonStyle: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--border)',
  borderRadius: '999px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 600
}

export const activeFilterButtonStyle: CSSProperties = {
  background: 'var(--accent-cyan)',
  borderColor: 'var(--accent-cyan)',
  color: 'var(--text-on-accent)'
}

export const controlLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  color: 'var(--text-secondary)',
  fontSize: '12px'
}

export const selectStyle: CSSProperties = {
  padding: '5px 8px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)'
}

export const checkboxLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: 'var(--text-secondary)',
  fontSize: '12px',
  cursor: 'pointer'
}

export const listStyle: CSSProperties = {
  display: 'grid',
  gap: '10px'
}

export const cardStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '13px',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  background: 'var(--bg-primary)'
}

export const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap'
}

export const nameRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  flexWrap: 'wrap'
}

export const nameStyle: CSSProperties = {
  color: 'var(--text-primary)',
  overflowWrap: 'anywhere'
}

export const pidStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'monospace',
  fontSize: '12px'
}

export const systemBadgeStyle: CSSProperties = {
  padding: '2px 6px',
  borderRadius: '999px',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  fontSize: '10px',
  fontWeight: 700
}

export const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '5px',
  marginTop: '7px'
}

export const anomalyBadgeStyle: CSSProperties = {
  padding: '2px 7px',
  border: '1px solid var(--border)',
  borderRadius: '999px',
  fontSize: '10px',
  fontWeight: 700
}

export const actionStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
}

export const secondaryButtonStyle: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'transparent',
  color: 'var(--accent-cyan)',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 600
}

export const dangerButtonStyle: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--alert-red-border)',
  borderRadius: '6px',
  background: 'var(--alert-red-soft)',
  color: 'var(--accent-red)',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 700
}

export const dangerFilledButtonStyle: CSSProperties = {
  ...dangerButtonStyle,
  background: 'var(--accent-red)',
  borderColor: 'var(--accent-red)',
  color: 'var(--text-on-accent)'
}

export const metricsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))',
  gap: '8px'
}

export const metricStyle: CSSProperties = {
  display: 'grid',
  gap: '3px',
  minWidth: 0
}

export const metricLabelStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
}

export const metricValueStyle: CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'monospace',
  fontSize: '12px',
  overflowWrap: 'anywhere'
}

export const zombieHelpStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: '12px',
  lineHeight: 1.5
}

export const emptyStyle: CSSProperties = {
  padding: '28px 16px',
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: '13px'
}
